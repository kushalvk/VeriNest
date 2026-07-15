const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['tenant', 'landlord', 'admin'],
      default: 'tenant',
    },
    profileImage: {
      publicId: { type: String },
      url: { type: String },
    },
    otp: { type: String, select: false },
    otpPurpose: {
      type: String,
      enum: ['signup', 'forgot_password', 'email_verification', 'login'],
    },
    otpExpiresAt: { type: Date },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'blocked'],
      default: 'pending',
    },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Safety net: even if these fields were explicitly selected,
      // they must never be serialized into an API response.
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.otp;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
