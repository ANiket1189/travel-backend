const mongoose = require('mongoose');

/**
 * Schema for the TravelPackage model
 * Fields:
 *  - title: Name of the travel package
 *  - description: Details about the travel package
 *  - price: Cost of the package
 *  - duration: Duration of the trip (e.g., '7 days')
 *  - destination: Destination of the trip
 *  - category: Category of the trip (e.g., 'Adventure', 'Romantic')
 *  - availability: Number of slots available
 *  - createdAt: Date when the package was created
 */
const travelPackageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  duration: {
    type: String,
    required: true,
  },
  destination: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Adventure', 'Romantic', 'Family', 'Cultural', 'Other'], // Optional categories
  },
  availability: {
    type: Number,
    required: true,
    min: 0,
  },
  createdAt: {
    type: String,
    default: new Date().toISOString(),
  },
});

// Export the TravelPackage model
module.exports = mongoose.model('TravelPackage', travelPackageSchema);