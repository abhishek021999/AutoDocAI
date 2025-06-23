require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('./config/s3');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Test AWS S3 connection
const testS3Connection = async () => {
  try {
    // First check if credentials are available
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured');
    }

    // Try to list objects in the bucket instead of getting a specific file
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: 'test.txt'
    });

    try {
      await s3Client.send(command);
      console.log('AWS S3 connection successful');
    } catch (error) {
      // If the error is because the test file doesn't exist, that's okay
      if (error.name === 'NoSuchKey') {
        console.log('AWS S3 connection successful (test file not found)');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('AWS S3 connection error:', error.message);
    console.error('Please check your AWS credentials and configuration');
  }
};

// Test S3 connection on startup
testS3Connection();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pdfs', require('./routes/pdf'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 