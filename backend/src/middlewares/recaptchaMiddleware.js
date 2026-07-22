const recaptchaService = require('../services/recaptchaService');

if (!recaptchaService.isConfigured()) {
  console.warn(
    '[recaptcha] RECAPTCHA_SECRET_KEY is not set — register/login run WITHOUT ' +
      'bot protection (dev fallback). Set RECAPTCHA_SECRET_KEY to enable it.'
  );
}

/**
 * Gate an endpoint behind a server-side reCAPTCHA v3 check.
 *
 * requireRecaptcha("register") expects req.body.recaptchaToken minted by the
 * frontend with executeRecaptcha("register") — the action names must match
 * exactly, so a token from one form can never be replayed against another.
 *
 * Unconfigured (no RECAPTCHA_SECRET_KEY): requests pass through, but every
 * single one is logged — the fallback exists for dev machines and must never
 * be silently relied on in production.
 *
 * Configured: verification failures (bot score, bad/missing token, action
 * mismatch, or Google outage — fail closed) return 403 with a user-friendly
 * message; the specific reason goes to the server log only.
 */
const requireRecaptcha = (expectedAction) => async (req, res, next) => {
  if (!recaptchaService.isConfigured()) {
    console.warn(
      `[recaptcha] allowing "${expectedAction}" request WITHOUT verification — RECAPTCHA_SECRET_KEY not set (dev fallback)`
    );
    return next();
  }

  try {
    const { recaptchaToken } = req.body || {};
    const result = await recaptchaService.verifyRecaptcha(recaptchaToken, expectedAction);

    if (!result.success) {
      console.warn(
        `[recaptcha] blocked "${expectedAction}" request from ${req.ip}: ${result.reason}`
      );
      return res
        .status(403)
        .json({ error: "We couldn't verify that you're human. Please try again." });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { requireRecaptcha };
