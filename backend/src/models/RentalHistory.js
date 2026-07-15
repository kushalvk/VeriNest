const mongoose = require('mongoose');

/**
 * Consolidation decision: the original spec sketched a separate "ratings"
 * table. Ratings here are strictly 1:1 with a tenancy (each party rates the
 * other once per rental), so they are embedded in RentalHistory instead of
 * a second collection — less complexity, no joins, same data.
 *
 * Rating direction: tenantRating/tenantReview = what the LANDLORD said
 * about the tenant; landlordRating/landlordReview = what the TENANT said
 * about the landlord.
 */
const rentalHistorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    agreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agreement',
      required: true,
      unique: true,
    },
    moveInDate: { type: Date },
    moveOutDate: { type: Date },
    rentAmount: { type: Number },
    securityDeposit: { type: Number },
    tenantRating: { type: Number, min: 1, max: 5 },
    landlordRating: { type: Number, min: 1, max: 5 },
    tenantReview: { type: String },
    landlordReview: { type: String },
    paymentStatus: {
      type: String,
      enum: ['clear', 'pending', 'default'],
      default: 'clear',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RentalHistory', rentalHistorySchema);
