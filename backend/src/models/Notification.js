const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['email', 'push'], default: 'push' },
    event: {
      type: String,
      enum: [
        'verification_request',
        'application',
        'agreement',
        'rent_due',
        'document_expired',
        'general',
      ],
      required: true,
    },
    isRead: { type: Boolean, default: false },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
