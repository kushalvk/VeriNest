const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const authMiddleware = require('../middlewares/authMiddleware');
const controller = require('../controllers/chatController');

const router = express.Router();

router.use(authMiddleware);

// 20 questions per hour PER USER (keyed by authenticated user id, with an
// IP fallback that should never trigger behind authMiddleware) — controls
// Gemini API cost exposure.
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({
      error: 'Assistant rate limit reached (20 questions per hour). Please try again later.',
    });
  },
});

router.post('/', chatLimiter, controller.askAssistant);

module.exports = router;
