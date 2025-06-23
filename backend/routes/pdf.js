const express = require('express');
const multer = require('multer');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, bucketName, getS3Url, getCorsHeaders } = require('../config/s3');
const PDF = require('../models/PDF');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function generateSummary(text) {
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key is not configured.');
    return '';
  }
  if (!text) {
    return '';
  }

  try {
    // The model works best with clear instructions
    const prompt = `Please provide a concise summary of the following text. Focus on the main points and key information:

${text.substring(0, 10000)} // Limiting to 10k chars to avoid token limits

Please provide the summary in a clear, well-structured format.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating summary with Gemini:', error.message);
    return '';
  }
}

const router = express.Router();

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Add CORS middleware
router.use((req, res, next) => {
  Object.entries(getCorsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
});

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Helper function to generate signed URL
const generateSignedUrl = async (key) => {
  if (!key) {
    console.error('Storage path is missing');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: 'inline; filename="document.pdf"',
    });

    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600,
      signableHeaders: new Set(['host', 'range', 'origin'])
    });
    
    console.log('Generated signed URL for key:', key);
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL for key:', key, error);
    return null;
  }
};

// Upload PDF
router.post('/upload', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;
    const key = `pdfs/${req.user.id}/${Date.now()}-${file.originalname}`;

    console.log('Uploading file with key:', key);

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline'
    };

    try {
      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log('File uploaded to S3 successfully');

      // Get page count from the PDF
      const loadedPdf = await PDFDocument.load(file.buffer);
      const pageCount = loadedPdf.getPageCount();
      console.log('PDF page count:', pageCount);

      // Extract text from the PDF
      const pdfData = await pdfParse(file.buffer);
      const textContent = pdfData.text;

      // Generate summary with Gemini
      const summary = await generateSummary(textContent);

      // Generate a signed URL for the uploaded file
      const signedUrl = await generateSignedUrl(key);
      if (!signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      // Save PDF document to database
      const pdfDoc = new PDF({
        title: file.originalname,
        url: signedUrl,
        storagePath: key,
        user: req.user.id,
        size: file.size,
        pageCount: pageCount,
        uploadDate: new Date(),
        textContent: textContent,
        summary: summary,
      });

      await pdfDoc.save();
      console.log('PDF document saved to database');

      res.status(201).json({
        message: 'PDF uploaded successfully',
        pdf: pdfDoc,
      });
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      throw new Error(`S3 upload failed: ${s3Error.message}`);
    }
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({
      message: 'Error uploading PDF',
      error: error.message
    });
  }
});

// Get all PDFs for a user
router.get('/', auth, async (req, res) => {
  try {
    const pdfs = await PDF.find({ user: req.user.id }).select('+uploadDate');
    console.log(`Found ${pdfs.length} PDFs for user ${req.user.id}`);
    
    // Generate new signed URLs for each PDF
    const pdfsWithUrls = await Promise.all(
      pdfs.map(async (pdf) => {
        try {
          if (!pdf.storagePath) {
            console.warn(`PDF ${pdf._id} has no storage path`);
            return {
              ...pdf.toObject(),
              url: null,
              error: 'Storage path missing'
            };
          }

          console.log('Generating URL for PDF:', pdf._id, 'with storage path:', pdf.storagePath);
          const signedUrl = await generateSignedUrl(pdf.storagePath);
          
          if (!signedUrl) {
            return {
              ...pdf.toObject(),
              url: null,
              error: 'Failed to generate signed URL'
            };
          }

          return {
            ...pdf.toObject(),
            url: signedUrl,
          };
        } catch (error) {
          console.error(`Error processing PDF ${pdf._id}:`, error);
          return {
            ...pdf.toObject(),
            url: null,
            error: error.message
          };
        }
      })
    );

    res.json(pdfsWithUrls);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({
      message: 'Error fetching PDFs',
      error: error.message
    });
  }
});

// Export PDF with annotations
router.get('/:id/export', auth, async (req, res) => {
  try {
    console.log('Starting PDF export for ID:', req.params.id);
    
    // Check if S3 is configured
    if (!bucketName || !process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('S3 configuration is missing:', {
        bucketName: !!bucketName,
        region: !!process.env.AWS_REGION,
        accessKey: !!process.env.AWS_ACCESS_KEY_ID,
        secretKey: !!process.env.AWS_SECRET_ACCESS_KEY
      });
      return res.status(500).json({ 
        message: 'Storage configuration is missing. Please contact the administrator.',
        error: 'S3_CONFIG_MISSING'
      });
    }
    
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      console.log('PDF not found with ID:', req.params.id);
      return res.status(404).json({ message: 'PDF not found' });
    }

    console.log('Found PDF:', {
      id: pdf._id,
      title: pdf.title,
      storagePath: pdf.storagePath,
      highlightsCount: pdf.highlights?.length || 0
    });

    if (!pdf.storagePath) {
      console.error('PDF has no storage path:', pdf._id);
      return res.status(400).json({ 
        message: 'PDF has no storage path',
        error: 'STORAGE_PATH_MISSING'
      });
    }

    try {
      // Get the PDF from S3
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: pdf.storagePath,
      });

      console.log('Fetching PDF from S3:', {
        bucket: bucketName,
        key: pdf.storagePath
      });

      const response = await s3Client.send(command);
      console.log('Successfully fetched PDF from S3');
      
      const pdfBytes = await response.Body.transformToByteArray();
      console.log('Transformed PDF to byte array, size:', pdfBytes.length);
      
      // Load the PDF document
      console.log('Loading PDF document...');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      console.log('PDF loaded successfully, pages:', pages.length);
      
      // Embed fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      console.log('Fonts embedded successfully');

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        try {
          const page = pages[i];
          const { width, height } = page.getSize();
          
          // Get highlights for this page
          const pageHighlights = pdf.highlights.filter(h => h.page === i + 1);
          
          // Process highlights first
          pageHighlights.forEach((highlight, index) => {
            try {
              // Get the text content and position from the original PDF
              const textContent = highlight.text;
              
              // Calculate highlight position based on the text selection
              const textPosition = {
                x: 50 + (highlight.start * 0.1),
                y: height - (highlight.start * 0.1),
                width: (highlight.end - highlight.start) * 0.1,
                height: 20
              };

              // Create proper PDF highlight annotation
              const color = highlight.color || 'yellow';
              const rgbColor = getRGBColor(color);
              
              // First draw the highlight rectangle
              page.drawRectangle({
                x: textPosition.x,
                y: textPosition.y - 2,
                width: textPosition.width,
                height: textPosition.height + 4,
                color: rgbColor,
                opacity: 0.3,
                borderColor: rgbColor,
                borderWidth: 1
              });

              // Then draw the text on top of the highlight
              page.drawText(textContent, {
                x: textPosition.x,
                y: textPosition.y + 4,
                size: 12,
                color: rgb(0, 0, 0),
                font: helveticaBold,
                maxWidth: textPosition.width
              });

              // If there's a comment, draw it right after the highlighted text
              if (highlight.comment) {
                const footnoteNumber = index + 1;
                page.drawText(`${footnoteNumber}.`, {
                  x: textPosition.x - 5,
                  y: textPosition.y + 4,
                  size: 12,
                  color: rgb(0, 0, 0),
                  font: helveticaBold
                });

                page.drawText(`: ${highlight.comment}`, {
                  x: textPosition.x + textPosition.width + 5,
                  y: textPosition.y + 4,
                  size: 12,
                  color: rgb(0, 0, 0),
                  font: helveticaFont
                });
              }
            } catch (highlightError) {
              console.error('Error processing highlight:', highlightError);
            }
          });

          // Add footnotes at the bottom of the page content
          if (pageHighlights.some(h => h.comment)) {
            try {
              // Calculate the starting Y position for footnotes
              // Start from the bottom of the page content (approximately 100 units from bottom)
              const footerStartY = 150; // Increased distance from bottom
              const footerX = 50;
              const margin = 50;
              
              // Draw a thicker separator line
              page.drawLine({
                start: { x: margin, y: footerStartY + 20 },
                end: { x: width - margin, y: footerStartY + 20 },
                thickness: 1.5, // Increased thickness
                color: rgb(0.2, 0.2, 0.2) // Darker color for better visibility
              });

              // Add "Footnotes" header with improved visibility
              page.drawText('Footnotes:', {
                x: footerX,
                y: footerStartY,
                size: 14,
                color: rgb(0, 0, 0),
                font: helveticaBold
              });
              //dbsmnbdsdnbsbnnbv bsvssbhs

              // Add each footnote in a clear format
              let currentY = footerStartY - 30; // Increased spacing after header
              pageHighlights.forEach((highlight, index) => {
                if (highlight.comment) {
                  const footnoteNumber = index + 1;
                  const highlightColor = getRGBColor(highlight.color || 'yellow');
                  
                  // Draw the footnote number and highlighted text
                  page.drawText(`${footnoteNumber}. ${highlight.text}:`, {
                    x: footerX,
                    y: currentY,
                    size: 12,
                    color: highlightColor,
                    font: helveticaBold,
                    maxWidth: width - 100
                  });
                  
                  // Draw the comment on the next line, indented
                  page.drawText(highlight.comment, {
                    x: footerX + 20, // Indent the comment
                    y: currentY - 20, // Move down for the comment
                    size: 12,
                    color: rgb(0, 0, 0),
                    font: helveticaFont,
                    maxWidth: width - 120
                  });
                  
                  currentY -= 50; // Increased spacing between footnotes
                }
              });

              // Add page number at the very bottom
              page.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: width - 100,
                y: margin,
                size: 9,
                color: rgb(0.5, 0.5, 0.5),
                font: helveticaFont
              });
            } catch (footnoteError) {
              console.error('Error adding footnotes:', footnoteError);
            }
          }
        } catch (pageError) {
          console.error('Error processing page:', pageError);
        }
      }

      // Save the modified PDF
      console.log('Saving modified PDF with embedded highlights...');
      const modifiedPdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
        preserveEditability: true
      });
      console.log('PDF saved successfully, size:', modifiedPdfBytes.length);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.title.replace('.pdf', '')}_annotated.pdf"`);
      
      // Send the modified PDF
      console.log('Sending PDF response...');
      res.send(Buffer.from(modifiedPdfBytes));
      console.log('PDF export completed successfully');
    } catch (s3Error) {
      console.error('S3 operation failed:', {
        error: s3Error.message,
        stack: s3Error.stack,
        code: s3Error.code
      });
      return res.status(500).json({ 
        message: 'Failed to access PDF storage',
        error: 'S3_OPERATION_FAILED',
        details: s3Error.message
      });
    }
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ 
      message: 'Error exporting PDF',
      error: error.message 
    });
  }
});

// Generate annotated PDF
router.post('/:id/generate-annotated', auth, async (req, res) => {
  try {
    console.log('Generating annotated PDF for ID:', req.params.id);
    
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      console.log('PDF not found with ID:', req.params.id);
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (!pdf.storagePath) {
      console.error('PDF has no storage path:', pdf._id);
      return res.status(400).json({ 
        message: 'PDF has no storage path',
        error: 'STORAGE_PATH_MISSING'
      });
    }

    try {
      // Get the PDF from S3
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: pdf.storagePath,
      });

      const response = await s3Client.send(command);
      const pdfBytes = await response.Body.transformToByteArray();
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      
      // Embed fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        try {
          const page = pages[i];
          const { width, height } = page.getSize();
          
          // Get highlights for this page
          const pageHighlights = pdf.highlights.filter(h => h.page === i + 1);
          
          // Process highlights
          pageHighlights.forEach((highlight, index) => {
            try {
              // Get the text content and position from the original PDF
              const textContent = highlight.text;
              
              // Calculate highlight position based on the text selection
              const textPosition = {
                x: 50 + (highlight.start * 0.1),
                y: height - (highlight.start * 0.1),
                width: (highlight.end - highlight.start) * 0.1,
                height: 20
              };

              // Create proper PDF highlight annotation
              const color = highlight.color || 'yellow';
              const rgbColor = getRGBColor(color);
              
              // First draw the highlight rectangle
              page.drawRectangle({
                x: textPosition.x,
                y: textPosition.y - 2,
                width: textPosition.width,
                height: textPosition.height + 4,
                color: rgbColor,
                opacity: 0.3,
                borderColor: rgbColor,
                borderWidth: 1
              });

              // Then draw the text on top of the highlight
              page.drawText(textContent, {
                x: textPosition.x,
                y: textPosition.y + 4,
                size: 12,
                color: rgb(0, 0, 0),
                font: helveticaBold,
                maxWidth: textPosition.width
              });

              // If there's a comment, draw it right after the highlighted text
              if (highlight.comment) {
                const footnoteNumber = index + 1;
                page.drawText(`${footnoteNumber}.`, {
                  x: textPosition.x - 5,
                  y: textPosition.y + 4,
                  size: 12,
                  color: rgb(0, 0, 0),
                  font: helveticaBold
                });

                page.drawText(`: ${highlight.comment}`, {
                  x: textPosition.x + textPosition.width + 5,
                  y: textPosition.y + 4,
                  size: 12,
                  color: rgb(0, 0, 0),
                  font: helveticaFont
                });
              }
            } catch (highlightError) {
              console.error('Error processing highlight:', highlightError);
            }
          });

          // Add footnotes at the bottom
          if (pageHighlights.some(h => h.comment)) {
            try {
              const footerStartY = 100;
              const footerX = 50;
              const margin = 50;
              
              // Draw separator line
              page.drawLine({
                start: { x: margin, y: footerStartY + 20 },
                end: { x: width - margin, y: footerStartY + 20 },
                thickness: 1,
                color: rgb(0.3, 0.3, 0.3)
              });

              // Add footnotes header
              page.drawText('Footnotes:', {
                x: footerX,
                y: footerStartY,
                size: 14,
                color: rgb(0, 0, 0),
                font: helveticaBold
              });

              // Add footnotes
              let currentY = footerStartY - 25;
              pageHighlights.forEach((highlight, index) => {
                if (highlight.comment) {
                  const footnoteNumber = index + 1;
                  const highlightColor = getRGBColor(highlight.color || 'yellow');
                  
                  page.drawText(`${footnoteNumber}. ${highlight.text}:`, {
                    x: footerX,
                    y: currentY,
                    size: 12,
                    color: highlightColor,
                    font: helveticaBold,
                    maxWidth: width - 100
                  });
                  
                  page.drawText(highlight.comment, {
                    x: footerX + 20,
                    y: currentY - 20,
                    size: 12,
                    color: rgb(0, 0, 0),
                    font: helveticaFont,
                    maxWidth: width - 120
                  });
                  
                  currentY -= 45;
                }
              });

              // Add page number
              page.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: width - 100,
                y: margin,
                size: 9,
                color: rgb(0.5, 0.5, 0.5),
                font: helveticaFont
              });
            } catch (footnoteError) {
              console.error('Error adding footnotes:', footnoteError);
            }
          }
        } catch (pageError) {
          console.error('Error processing page:', pageError);
        }
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
        preserveEditability: true
      });
      
      // Store the annotated PDF in S3
      const annotatedKey = `annotated/${pdf._id}/${Date.now()}-annotated.pdf`;
      const uploadParams = {
        Bucket: bucketName,
        Key: annotatedKey,
        Body: Buffer.from(modifiedPdfBytes),
        ContentType: 'application/pdf',
        ContentDisposition: 'inline'
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      
      // Generate a signed URL for the annotated PDF
      const signedUrl = await generateSignedUrl(annotatedKey);
      
      // Update the PDF document with the annotated version
      pdf.annotatedVersion = {
        url: signedUrl,
        storagePath: annotatedKey,
        generatedAt: new Date()
      };
      await pdf.save();

      res.json({
        message: 'Annotated PDF generated successfully',
        url: signedUrl,
        pdf: pdf
      });
    } catch (s3Error) {
      console.error('S3 operation failed:', s3Error);
      return res.status(500).json({ 
        message: 'Failed to process PDF',
        error: 'S3_OPERATION_FAILED',
        details: s3Error.message
      });
    }
  } catch (error) {
    console.error('Error generating annotated PDF:', error);
    res.status(500).json({ 
      message: 'Error generating annotated PDF',
      error: error.message 
    });
  }
});

// Export annotated PDF
router.get('/:id/export', auth, async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (!pdf.annotatedVersion?.storagePath) {
      return res.status(400).json({ 
        message: 'No annotated version available. Please generate it first.',
        error: 'NO_ANNOTATED_VERSION'
      });
    }

    // Get the annotated PDF from S3
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: pdf.annotatedVersion.storagePath,
    });

    const response = await s3Client.send(command);
    const pdfBytes = await response.Body.transformToByteArray();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.title.replace('.pdf', '')}_annotated.pdf"`);
    
    // Send the PDF
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ 
      message: 'Error exporting PDF',
      error: error.message 
    });
  }
});

// Helper function to split text into lines that fit within a width
function splitTextIntoLines(text, maxWidth, font, fontSize) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Helper function to convert color name to RGB
function getRGBColor(color) {
  const colors = {
    yellow: rgb(1, 1, 0),
    blue: rgb(0, 0, 1),
    green: rgb(0, 1, 0),
    red: rgb(1, 0, 0),
    purple: rgb(0.5, 0, 0.5),
    pink: rgb(1, 0.4, 0.7),
    orange: rgb(1, 0.6, 0)
  };
  return colors[color] || colors.yellow;
}

// Get a single PDF
router.get('/:id', auth, async (req, res) => {
  try {
    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).select('+uploadDate');

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (!pdf.storagePath) {
      return res.status(400).json({ 
        message: 'PDF has no storage path',
        pdf: pdf.toObject()
      });
    }

    console.log('Generating URL for PDF:', pdf._id, 'with storage path:', pdf.storagePath);
    const signedUrl = await generateSignedUrl(pdf.storagePath);

    if (!signedUrl) {
      return res.status(500).json({
        message: 'Failed to generate signed URL',
        pdf: pdf.toObject()
      });
    }

    res.json({
      ...pdf.toObject(),
      url: signedUrl,
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({
      message: 'Error fetching PDF',
      error: error.message
    });
  }
});

// Delete PDF
router.delete('/:id', auth, async (req, res) => {
  try {
    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (pdf.storagePath) {
      console.log('Deleting file from S3:', pdf.storagePath);
      // Delete from S3
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: pdf.storagePath,
        })
      );
    }

    // Delete from database
    await PDF.deleteOne({ _id: req.params.id });
    console.log('PDF deleted successfully');

    res.json({ message: 'PDF deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({
      message: 'Error deleting PDF',
      error: error.message
    });
  }
});

// Highlight routes
// Add highlight to PDF
router.post('/:id/highlights', auth, async (req, res) => {
  try {
    console.log('Adding highlight to PDF:', req.params.id);
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    const { text, color, comment, page, start, end } = req.body;
    if (!text || !page || start === undefined || end === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const highlight = {
      text,
      color: color || 'yellow',
      comment,
      page,
      start,
      end,
      createdAt: new Date()
    };

    pdf.highlights.push(highlight);
    await pdf.save();

    res.status(201).json(highlight);
  } catch (error) {
    console.error('Error adding highlight:', error);
    res.status(500).json({ message: 'Error adding highlight' });
  }
});

// Update highlight
router.put('/:id/highlights/:highlightId', auth, async (req, res) => {
  try {
    console.log('Update highlight request:', {
      pdfId: req.params.id,
      highlightId: req.params.highlightId,
      body: req.body
    });

    const pdf = await PDF.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!pdf) {
      console.log('PDF not found:', req.params.id);
      return res.status(404).json({ message: 'PDF not found' });
    }

    const highlightIndex = pdf.highlights.findIndex(
      h => h._id.toString() === req.params.highlightId
    );

    if (highlightIndex === -1) {
      console.log('Highlight not found:', req.params.highlightId);
      return res.status(404).json({ message: 'Highlight not found' });
    }

    const { color, comment } = req.body;
    console.log('Updating highlight with:', { color, comment });

    // Update the highlight
    if (color) pdf.highlights[highlightIndex].color = color;
    if (comment !== undefined) pdf.highlights[highlightIndex].comment = comment;

    await pdf.save();
    console.log('Highlight updated successfully');

    // Return the updated highlight
    res.json(pdf.highlights[highlightIndex]);
  } catch (error) {
    console.error('Error updating highlight:', error);
    res.status(500).json({ message: 'Error updating highlight' });
  }
});

// Delete highlight
router.delete('/:id/highlights/:highlightId', auth, async (req, res) => {
  try {
    const pdfId = req.params.id;
    const highlightId = req.params.highlightId;
    const userId = req.user.id;

    console.log('Delete highlight request:', {
      pdfId,
      highlightId,
      userId
    });

    // Use MongoDB's native update operation to remove the highlight
    const result = await PDF.updateOne(
      {
        _id: pdfId,
        user: userId
      },
      {
        $pull: {
          highlights: {
            _id: new mongoose.Types.ObjectId(highlightId)
          }
        }
      }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      console.log('PDF not found or unauthorized:', {
        pdfId,
        userId
      });
      return res.status(404).json({ message: 'PDF not found' });
    }

    if (result.modifiedCount === 0) {
      console.log('No highlight was removed:', highlightId);
      return res.status(404).json({ message: 'Highlight not found' });
    }

    // Verify the highlight was actually removed
    const pdf = await PDF.findOne({
      _id: pdfId,
      'highlights._id': { $ne: new mongoose.Types.ObjectId(highlightId) }
    });

    if (!pdf) {
      throw new Error('Failed to verify highlight deletion');
    }

    console.log('Highlight deleted successfully:', {
      highlightId,
      remainingHighlights: pdf.highlights.length
    });

    res.json({ 
      message: 'Highlight deleted successfully',
      highlightId
    });
  } catch (error) {
    console.error('Error deleting highlight:', {
      error: error.message,
      stack: error.stack,
      pdfId: req.params.id,
      highlightId: req.params.highlightId
    });
    res.status(500).json({ 
      message: 'Error deleting highlight',
      error: error.message 
    });
  }
});

module.exports = router; 