const mongoose = require('mongoose');

const trustScoreHistorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    score: { type: Number, required: true },
    reasons: [{ type: String }],
    generatedBy: {
      type: String,
      enum: ['AI', 'Admin', 'System'],
      default: 'System',
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrustScoreHistory', trustScoreHistorySchema);
