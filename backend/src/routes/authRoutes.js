const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRecaptcha } = require('../middlewares/recaptchaMiddleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again after 15 minutes.',
    });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many accounts created from this address. Please try again later.',
    });
  },
});

// Same budget as login: resets are guessing targets for the 6-digit OTP.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many reset attempts. Please try again after 15 minutes.',
    });
  },
});

// Google sign-in doubles as both login and signup, so it needs a little more
// headroom than the 5/15min login limiter — 10/15min per IP.
const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many Google sign-in attempts. Please try again after 15 minutes.',
    });
  },
});

// Defense in depth: rate limiter AND reCAPTCHA are both active. The limiter
// runs first because it's free and local — a flood gets 429'd before it can
// turn every request into an outbound Google siteverify call. reCAPTCHA is
// deliberately NOT applied to /refresh, /logout, /reset-password or the OTP
// routes (token-based or already tightly rate-limited).
router.post('/register', registerLimiter, requireRecaptcha('register'), authController.register);
router.post('/login', loginLimiter, requireRecaptcha('login'), authController.login);
router.post('/google', googleLimiter, googleAuthController.googleLogin);
router.patch('/set-role', authMiddleware, googleAuthController.setRole);
router.post('/reset-password', resetLimiter, authController.resetPassword);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Temporary protected test route — returns the decoded token payload.
router.get('/me', authMiddleware, (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = router;
