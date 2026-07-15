const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authService = require('../services/authService');
const emailService = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

/**
 * Refresh tokens are stored bcrypt-hashed, so they cannot be looked up
 * directly. The token's JWT payload gives us the userId; we then compare
 * the presented token against that user's stored (unexpired) hashes.
 * Returns the matching RefreshToken document, or null.
 */
const findStoredRefreshToken = async (userId, presentedToken) => {
  const candidates = await RefreshToken.find({
    userId,
    expiresAt: { $gt: new Date() },
  });

  for (const record of candidates) {
    const matches = await bcrypt.compare(presentedToken, record.refreshToken);
    if (matches) return record;
  }
  return null;
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role } = req.body || {};

    if (
      [fullName, email, phone, password].some(
        (v) => typeof v !== 'string' || !v.trim()
      )
    ) {
      return res
        .status(422)
        .json({ error: 'fullName, email, phone and password are required' });
    }
    // Self-service roles only — "admin" can never be self-assigned.
    if (role !== undefined && !['tenant', 'landlord'].includes(role)) {
      return res
        .status(422)
        .json({ error: 'role must be "tenant" or "landlord"' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(422).json({ error: 'Invalid email address' });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res
        .status(422)
        .json({ error: 'Phone number must be 10-15 digits' });
    }
    if (password.length < 8) {
      return res
        .status(422)
        .json({ error: 'Password must be at least 8 characters long' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });
    if (existing) {
      const message =
        existing.email === email.toLowerCase()
          ? 'Email already registered'
          : 'Phone number already registered';
      return res.status(409).json({ error: message });
    }

    const hashedPassword = await authService.hashPassword(password);
    const user = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: role || 'tenant',
      accountStatus: 'pending',
    });

    // No tokens yet — email verification comes first.
    return res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user,
    });
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/reset-password  body: { email, otp, newPassword }
// Completes the forgot-password flow: verifies the emailed OTP (purpose
// "forgot_password") and sets the new password in one atomic step — the
// OTP is consumed here, never via the generic /otp/verify endpoint.
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (
      typeof email !== 'string' || !email ||
      (typeof otp !== 'string' && typeof otp !== 'number') || !String(otp) ||
      typeof newPassword !== 'string' || !newPassword
    ) {
      return res
        .status(422)
        .json({ error: 'email, otp and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res
        .status(422)
        .json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp');
    // Generic errors: never reveal whether the email exists, which purpose
    // is pending, or which check failed (same policy as /otp/verify).
    if (!user || !user.otp || user.otpPurpose !== 'forgot_password') {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: 'OTP has expired. Please request a new one.' });
    }
    const matches = await bcrypt.compare(String(otp), user.otp);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await authService.hashPassword(newPassword);
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { otp: 1, otpPurpose: 1, otpExpiresAt: 1 },
      }
    );
    // A password reset must invalidate every existing session.
    await RefreshToken.deleteMany({ userId: user._id });

    // Best-effort security notice — never blocks the reset itself.
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Your VeriNest password was changed',
        text:
          `Hi ${user.fullName},\n\n` +
          'Your VeriNest password was just changed using an emailed reset code, ' +
          'and you have been signed out of all devices.\n\n' +
          'If this was you, no further action is needed. If you did not request ' +
          'this change, reset your password again immediately and contact support.',
      });
    } catch (err) {
      console.error(`[auth] Password-change notice failed: ${err.message}`);
    }

    return res.status(200).json({
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    // Strict string types: object payloads (e.g. {"$gt": ""}) must never
    // reach the query layer, even after global sanitization.
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(422).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );
    if (!user || !(await authService.comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.accountStatus === 'blocked') {
      return res.status(403).json({ error: 'This account has been blocked' });
    }

    const payload = { id: user._id.toString(), role: user.role };
    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = authService.generateRefreshToken(payload);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await RefreshToken.create({
      userId: user._id,
      refreshToken: hashedRefreshToken,
      expiresAt: new Date(Date.now() + authService.REFRESH_TOKEN_TTL_MS),
    });

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({ accessToken, refreshToken, user });
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(422).json({ error: 'refreshToken is required' });
    }

    let decoded;
    try {
      decoded = authService.verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await findStoredRefreshToken(decoded.id, refreshToken);
    if (!stored) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const accessToken = authService.generateAccessToken({
      id: decoded.id,
      role: decoded.role,
    });
    return res.status(200).json({ accessToken });
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(422).json({ error: 'refreshToken is required' });
    }

    let decoded;
    try {
      decoded = authService.verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await findStoredRefreshToken(decoded.id, refreshToken);
    if (stored) {
      await stored.deleteOne();
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login, refresh, logout, resetPassword };
