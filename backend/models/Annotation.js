const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  pdf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PDF',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pageNumber: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true,
    enum: ['yellow', 'blue', 'green', 'red', 'purple']
  },
  coordinates: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  comment: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
annotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Annotation = mongoose.model('Annotation', annotationSchema);

module.exports = Annotation; 