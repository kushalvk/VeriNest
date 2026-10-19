const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    agreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agreement',
      required: true,
    },
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ratee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    review: { type: String },
  },
  { timestamps: true }
);

// Unique index: one rating per agreement + rater combination
ratingSchema.index({ agreementId: 1, rater: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);