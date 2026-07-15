const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const otpController = require('../controllers/otpController');

const router = express.Router();

// 3 OTP emails per 10 minutes per email address (falls back to IP when
// the body has no email, e.g. malformed requests).
const sendOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    typeof req.body?.email === 'string'
      ? `email:${req.body.email.toLowerCase().trim()}`
      : ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many OTP requests. Please try again after 10 minutes.',
    });
  },
});

router.post('/send', sendOtpLimiter, otpController.sendOtp);
router.post('/verify', otpController.verifyOtp);

module.exports = router;
