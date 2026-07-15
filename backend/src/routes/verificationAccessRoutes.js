const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/verificationRequestController');

const router = express.Router();

// Public and token-protected — rate limit per IP to slow token guessing
// (tokens have 256 bits of entropy, so this is defense in depth).
const accessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many access attempts. Please try again later.',
    });
  },
});

// Public by design: access is protected entirely by token validity.
router.get('/access/:token', accessLimiter, controller.accessDocuments);

module.exports = router;
