const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const PDF = require('../models/PDF');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// async function main() {
//   const response = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: "Explain how AI works in a few words",
//   });
//   console.log(response.text);
// }

// main();

// POST /api/chatbot
router.post('/', async (req, res) => {
  const { userMessage, pdfId } = req.body;
  if (!userMessage || !pdfId) {
    return res.status(400).json({ error: 'userMessage and pdfId are required' });
  }

  try {
    // Fetch PDF textContent
    const pdf = await PDF.findById(pdfId);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found in database' });
    }
    if (!pdf.textContent) {
      return res.status(404).json({ error: 'PDF has no extracted textContent. Try re-uploading.' });
    }

    try {
      // Create prompt with PDF context
      const prompt = `Context from PDF: ${pdf.textContent.slice(0, 2000)}\n\nUser Question: ${userMessage}\n\nPlease provide a helpful response based on the PDF content.`;

      // Generate content using gemini-2.5-flash model
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const botReply = response.text;
      res.json({ botReply });
    } catch (apiErr) {
      console.error('Gemini API error:', apiErr);
      return res.status(502).json({ 
        error: 'Gemini API error', 
        details: apiErr.message 
      });
    }
  } catch (err) {
    console.error('Chatbot route error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router; 