const { buildUserContext } = require('../services/chatContextService');
const { askWithContext } = require('../services/geminiService');

const MAX_QUESTION_LENGTH = 500;

// POST /api/chat  body: { question }
const askAssistant = async (req, res, next) => {
  try {
    const { question } = req.body || {};

    if (typeof question !== 'string' || !question.trim()) {
      return res.status(422).json({ error: 'question must be a non-empty string' });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(422).json({
        error: `question must be at most ${MAX_QUESTION_LENGTH} characters`,
      });
    }

    const context = await buildUserContext(req.user.id, req.user.role);

    // Dev-only inspection hook: verify exactly what the model receives.
    if (process.env.CHAT_DEBUG_CONTEXT === '1') {
      console.log('[chat] context for user', req.user.id, JSON.stringify(context));
    }

    let answer;
    try {
      answer = await askWithContext(question.trim(), context);
    } catch (err) {
      // Quota, network, bad key, timeout — degrade gracefully, never 500.
      console.error(`[chat] Gemini call failed: ${err.message}`);
      return res.status(503).json({
        error: 'The assistant is temporarily unavailable. Please try again later.',
      });
    }

    return res.status(200).json({ answer });
  } catch (err) {
    return next(err);
  }
};

module.exports = { askAssistant };
