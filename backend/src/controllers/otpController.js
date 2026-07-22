const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { generateOtp, OTP_TTL_MS } = require('../services/otpService');

const OTP_PURPOSES = ['signup', 'forgot_password', 'email_verification', 'login'];

const PURPOSE_SUBJECTS = {
  signup: 'Verify your email address',
  email_verification: 'Verify your email address',
  forgot_password: 'Reset your password',
  login: 'Your login code',
};

// Generic on purpose: verification failures must not reveal whether the
// email exists, which purpose is pending, or which check failed.
const GENERIC_OTP_ERROR = 'Invalid or expired OTP';

// POST /api/auth/otp/send
const sendOtp = async (req, res, next) => {
  try {
    const { email, purpose } = req.body || {};

    if (typeof email !== 'string' || !email || typeof purpose !== 'string') {
      return res.status(422).json({ error: 'email and purpose are required' });
    }
    if (!OTP_PURPOSES.includes(purpose)) {
      return res.status(422).json({
        error: `purpose must be one of: ${OTP_PURPOSES.join(', ')}`,
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No account found for this email' });
    }

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: PURPOSE_SUBJECTS[purpose],
        text: `Your verification code is ${otp}. It expires in 10 minutes.`,
      });
    } catch (err) {
      console.error(`[otp] Email send failed: ${err.message}`);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Replaces any previous OTP — only the latest one can be verified.
    await User.updateOne(
      { _id: user._id },
      {
        otp: hashedOtp,
        otpPurpose: purpose,
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      }
    );

    return res
      .status(200)
      .json({ message: 'A verification code has been sent to your email.' });
  } catch (err) {
    return next(err);
  }
};

// POST /api/auth/otp/verify
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp, purpose } = req.body || {};

    if (
      typeof email !== 'string' || !email ||
      typeof purpose !== 'string' || !purpose ||
      (typeof otp !== 'string' && typeof otp !== 'number') || !String(otp)
    ) {
      return res
        .status(422)
        .json({ error: 'email, otp and purpose are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+otp'
    );

    if (!user || !user.otp || user.otpPurpose !== purpose) {
      return res.status(400).json({ error: GENERIC_OTP_ERROR });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: 'OTP has expired. Please request a new one.' });
    }

    const matches = await bcrypt.compare(String(otp), user.otp);
    if (!matches) {
      return res.status(400).json({ error: GENERIC_OTP_ERROR });
    }

    // Consume the OTP so it can never be used twice.
    const update = {
      $unset: { otp: 1, otpPurpose: 1, otpExpiresAt: 1 },
    };
    if (purpose === 'signup' || purpose === 'email_verification') {
      // A blocked account must not be re-activated (or handed a session
      // below) just because it can still receive email.
      if (user.accountStatus === 'blocked') {
        return res.status(403).json({ error: 'This account has been blocked' });
      }
      update.$set = { isEmailVerified: true, accountStatus: 'active' };
    }
    await User.updateOne({ _id: user._id }, update);

    // Signup verification doubles as the first login: the OTP just proved
    // control of the email — the same thing a password login would prove —
    // so hand back a session immediately instead of bouncing the brand-new
    // user to the login form. Re-fetch so the response reflects the update
    // (isEmailVerified/accountStatus) without the +otp selection.
    if (purpose === 'signup') {
      const verifiedUser = await User.findById(user._id);
      const { accessToken, refreshToken } = await authService.issueSession(verifiedUser);
      return res.status(200).json({
        message: 'OTP verified successfully',
        accessToken,
        refreshToken,
        user: verifiedUser,
      });
    }

    return res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { sendOtp, verifyOtp };
