const { OAuth2Client } = require('google-auth-library');

// Same OAuth 2.0 Web Client ID as the frontend (VITE_GOOGLE_CLIENT_ID). It is
// used as the audience the ID token MUST have been minted for — a token issued
// for any other client is rejected. Missing config is a deployment mistake, so
// we warn loudly at startup rather than failing silently later.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID is not set — "Sign in with Google" is disabled. ' +
      'Set GOOGLE_CLIENT_ID in the environment to enable it.'
  );
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token entirely server-side and return its payload.
 *
 * The token that reaches us came from the browser and is UNTRUSTED input.
 * verifyIdToken() checks the token's signature against Google's public keys,
 * that it has not expired, that the issuer is Google, and — crucially — that
 * its audience matches OUR client id. Only after all of that do we read any
 * claim (email, name, sub, email_verified) out of it.
 *
 * Throws an Error with a `.statusCode` so the controller can map it to the
 * right HTTP status:
 *   - 503 when the feature is unconfigured (no GOOGLE_CLIENT_ID)
 *   - 400 when no token was supplied
 *   - 401 when the token is invalid/expired/wrong-audience
 *
 * @param {string} idToken raw JWT credential from Google Identity Services
 * @returns {Promise<import('google-auth-library').TokenPayload>}
 */
const verifyGoogleToken = async (idToken) => {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error(
      'Google sign-in is not configured on this server. Please use email and password.'
    );
    err.statusCode = 503;
    throw err;
  }
  if (typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('A Google credential (idToken) is required.');
    err.statusCode = 400;
    throw err;
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  } catch {
    // Never surface the underlying library message — a generic 401 is enough
    // and avoids leaking why verification failed to a would-be attacker.
    const err = new Error('Google sign-in failed: the token is invalid or expired.');
    err.statusCode = 401;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    const err = new Error('Google sign-in failed: the token carried no email.');
    err.statusCode = 401;
    throw err;
  }
  return payload;
};

module.exports = { verifyGoogleToken, isConfigured: () => Boolean(GOOGLE_CLIENT_ID) };
