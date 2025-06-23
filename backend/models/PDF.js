const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  text: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'yellow'
  },
  comment: {
    type: String
  },
  page: {
    type: Number,
    required: true
  },
  start: {
    type: Number,
    required: true
  },
  end: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  textContent: {
    type: String,
  },
  summary: {
    type: String,
  },
  highlights: [highlightSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('PDF', pdfSchema); 