const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
    },
    message: { type: String },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fast duplicate detection for "has this tenant already applied here?"
applicationSchema.index({ tenantId: 1, propertyId: 1 });

module.exports = mongoose.model('Application', applicationSchema);
