const mongoose = require("mongoose");

/**
 * Schema for the Booking model
 * Fields:
 *  - packageId: Reference to the TravelPackage being booked
 *  - userId: Reference to the User making the booking
 *  - date: Date of the booking
 *  - status: Booking status ('Confirmed' or 'Cancelled')
 */
const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TravelPackage",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["CONFIRMED", "CANCELLED", "PENDING"],
    default: "CONFIRMED",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Export the Booking model
module.exports = mongoose.model("Booking", bookingSchema);
