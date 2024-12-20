const mongoose = require('mongoose');

/**
 * Schema for the Booking model
 * Fields:
 *  - packageId: Reference to the TravelPackage being booked
 *  - userId: Reference to the User making the booking
 *  - date: Date of the booking
 *  - status: Booking status ('Confirmed' or 'Cancelled')
 */
const bookingSchema = new mongoose.Schema({
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelPackage',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['CONFIRMED', 'PENDING', 'CANCELLED'],
    default: 'CONFIRMED',
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
});

// Export the Booking model
module.exports = mongoose.model('Booking', bookingSchema);