/**
 * Server-side Google reCAPTCHA v3 verification.
 *
 * The token from the browser is UNTRUSTED evidence — the only authoritative
 * check is this server-to-server call to Google's siteverify endpoint. The
 * frontend never gets to claim "passed"; it only forwards the token.
 *
 * Scoring: v3 is invisible and score-based (1.0 = very likely human,
 * 0.0 = very likely bot). Anything below MIN_SCORE is rejected. 0.5 is the
 * conventional default; tune it via RECAPTCHA_MIN_SCORE in the environment
 * (raise toward 0.7 if bots get through, lower toward 0.3 if real users are
 * being blocked — check the reCAPTCHA admin console's score distribution).
 *
 * Failure policy: this is a security control, so every failure mode fails
 * CLOSED (verification rejected) — including a Google API outage. Each
 * rejection carries a `reason` so the logs distinguish "bot blocked" from
 * "recaptcha service down".
 */

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

const MIN_SCORE = (() => {
  const parsed = Number.parseFloat(process.env.RECAPTCHA_MIN_SCORE);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.5;
})();

const isConfigured = () => Boolean(process.env.RECAPTCHA_SECRET_KEY);

/**
 * Verify a reCAPTCHA v3 token against Google and our own policy.
 *
 * @param {string} token raw token from the browser (req.body.recaptchaToken)
 * @param {string} expectedAction the action this endpoint minted its tokens
 *   for ("register", "login"). A token for any other action is rejected —
 *   otherwise a bot could grind a high-score token on a low-stakes form and
 *   replay it against a sensitive endpoint.
 * @returns {Promise<{ success: boolean, score: number|null, reason?: string }>}
 */
const verifyRecaptcha = async (token, expectedAction) => {
  if (typeof token !== 'string' || !token.trim()) {
    return { success: false, score: null, reason: 'missing token' };
  }

  let data;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });
    data = await res.json();
  } catch (err) {
    // Google unreachable / bad response — fail closed, but make the log
    // unmistakably "service problem", not "bot".
    console.error(
      `[recaptcha] siteverify call failed (${err.message}) — failing closed, request will be blocked`
    );
    return { success: false, score: null, reason: 'siteverify unreachable' };
  }

  if (!data.success) {
    const codes = (data['error-codes'] || []).join(', ') || 'none';
    return { success: false, score: null, reason: `siteverify rejected token (error-codes: ${codes})` };
  }
  if (data.action !== expectedAction) {
    return {
      success: false,
      score: data.score ?? null,
      reason: `action mismatch (expected "${expectedAction}", got "${data.action}")`,
    };
  }
  if (typeof data.score !== 'number' || data.score < MIN_SCORE) {
    return {
      success: false,
      score: data.score ?? null,
      reason: `score ${data.score} below threshold ${MIN_SCORE}`,
    };
  }

  return { success: true, score: data.score };
};

module.exports = { verifyRecaptcha, isConfigured, MIN_SCORE };
