const mongoose = require('mongoose');
require('dotenv').config();

const uri = "mongodb+srv://user:iter%40soa@cluster0.kcvmd.mongodb.net/?retryWrites=true&w=majority";

const connectDB = async () => {
  try {
    // Connect to MongoDB without deprecated options
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1); // Exit the process with failure
  }
};

module.exports = connectDB;
