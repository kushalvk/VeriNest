const mongoose = require('mongoose');

const verificationRequestSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    accessType: {
      type: String,
      enum: ['one_time', '24_hours', '7_days'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    // SHA-256 hash of the access token — the raw token is never persisted.
    secureToken: { type: String, select: false },
    expiresAt: { type: Date },
    viewedAt: { type: Date },
  },
  { timestamps: true }
);

// sparse: secureToken only exists once a request is approved
verificationRequestSchema.index({ secureToken: 1 }, { sparse: true });

module.exports = mongoose.model('VerificationRequest', verificationRequestSchema);
