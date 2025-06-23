const express = require('express');
const Annotation = require('../models/Annotation');
const PDF = require('../models/PDF');
const auth = require('../middleware/auth');

const router = express.Router();

// Create annotation
router.post('/', auth, async (req, res) => {
  try {
    const { pdfId, pageNumber, content, color, coordinates, comment } = req.body;

    // Verify PDF exists and belongs to user
    const pdf = await PDF.findOne({
      _id: pdfId,
      user: req.user._id
    });

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    const annotation = new Annotation({
      pdf: pdfId,
      user: req.user._id,
      pageNumber,
      content,
      color,
      coordinates,
      comment
    });

    await annotation.save();
    res.status(201).json(annotation);
  } catch (error) {
    res.status(500).json({ message: 'Error creating annotation' });
  }
});

// Get annotations for a PDF
router.get('/pdf/:pdfId', auth, async (req, res) => {
  try {
    // Verify PDF exists and belongs to user
    const pdf = await PDF.findOne({
      _id: req.params.pdfId,
      user: req.user._id
    });

    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    const annotations = await Annotation.find({
      pdf: req.params.pdfId,
      user: req.user._id
    }).sort({ pageNumber: 1, createdAt: 1 });

    res.json(annotations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching annotations' });
  }
});

// Update annotation
router.patch('/:id', auth, async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['content', 'color', 'coordinates', 'comment'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    const annotation = await Annotation.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    updates.forEach(update => annotation[update] = req.body[update]);
    await annotation.save();

    res.json(annotation);
  } catch (error) {
    res.status(500).json({ message: 'Error updating annotation' });
  }
});

// Delete annotation
router.delete('/:id', auth, async (req, res) => {
  try {
    const annotation = await Annotation.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    await annotation.remove();
    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting annotation' });
  }
});

// Search annotations
router.get('/search/:pdfId', auth, async (req, res) => {
  try {
    const { query, color, pageNumber } = req.query;
    const searchQuery = {
      pdf: req.params.pdfId,
      user: req.user._id
    };

    if (query) {
      searchQuery.$or = [
        { content: { $regex: query, $options: 'i' } },
        { comment: { $regex: query, $options: 'i' } }
      ];
    }

    if (color) {
      searchQuery.color = color;
    }

    if (pageNumber) {
      searchQuery.pageNumber = parseInt(pageNumber);
    }

    const annotations = await Annotation.find(searchQuery)
      .sort({ pageNumber: 1, createdAt: 1 });

    res.json(annotations);
  } catch (error) {
    res.status(500).json({ message: 'Error searching annotations' });
  }
});

module.exports = router; 