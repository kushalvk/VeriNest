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
    // Phone is optional at the schema level: Google sign-in provides no
    // phone number, so a Google-created account has none until the user
    // completes their profile. A sparse unique index lets many phone-less
    // users coexist (null/undefined is skipped by the index) while still
    // rejecting duplicate real numbers. Email/password registration still
    // requires phone — that rule is enforced in the register controller.
    phone: { type: String, unique: true, sparse: true, trim: true },
    // Password is optional at the schema level: Google-created accounts have
    // no password. The requirement for email/password signups is enforced in
    // the register controller, not here.
    password: { type: String, select: false },
    // No schema default: a Google signup starts with role unset (the user
    // picks tenant/landlord once, right after their first Google login, via
    // PATCH /api/auth/set-role). Email/password registration always sets a
    // role explicitly in the controller, so dropping the default is a no-op
    // for that flow. enum skips validation on an unset (undefined) value.
    role: {
      type: String,
      enum: ['tenant', 'landlord', 'admin'],
    },
    // How the account was originally created. Kept queryable even after a
    // local account is linked to Google (see googleAuthController) — a linked
    // local account stays authProvider:"local" and keeps its password.
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    // Google's stable subject id (payload.sub). select:false so it never
    // leaks in API responses; sparse unique so only Google-linked accounts
    // occupy the index.
    googleId: { type: String, unique: true, sparse: true, select: false },
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
        delete ret.googleId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
