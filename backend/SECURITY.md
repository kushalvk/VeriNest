# Security Overview — Backend

Summary of the security posture after the hardening pass (Task 19).
For future contributors: keep this file updated when limits or policies change.

## Authentication

- Bearer JWTs only (15-min access tokens, 7-day refresh tokens). **No cookies
  or sessions exist anywhere in the codebase** (audited — no `res.cookie`,
  `cookie-parser`, or `express-session` usage), so cookie flags are N/A.
- Refresh tokens are stored **bcrypt-hashed**; verification-access tokens are
  stored **SHA-256-hashed** (256-bit random). Raw tokens are never persisted
  and are redacted from request logs (`morgan` URL redaction in `app.js`).
- Passwords: bcrypt, 10 rounds, `select: false`, stripped by `toJSON`.

## CORS

Explicit allowlist from `ALLOWED_ORIGINS` (comma-separated env var),
default `http://localhost:5173`. Requests without an `Origin` header
(curl, server-to-server) pass; browser requests from any other origin
receive no CORS headers and are blocked by the browser.

## Helmet

`helmet()` v8 defaults applied globally in all environments — includes
Content-Security-Policy, HSTS, `X-Content-Type-Options: nosniff`,
frameguard, and referrer-policy.

## NoSQL injection defense (layered)

1. Global middleware strips keys starting with `$` or containing `.` from
   `req.body` / `req.params` / `req.query` via `express-mongo-sanitize`
   (applied in-place — Express 5's read-only `req.query` forbids the
   library's default reassignment mode).
2. Auth-critical endpoints (login, register, OTP send/verify, refresh,
   logout) additionally enforce strict `typeof === 'string'` checks so
   object payloads like `{"email": {"$gt": ""}}` are rejected with 422
   before any query runs.
3. All `:id` route params are validated with `ObjectId.isValid` before use.
4. User-supplied regex input (property city search) is escaped.

## Rate limits

| Endpoint | Limit | Window | Keyed by |
|---|---|---|---|
| `POST /api/auth/login` | 5 | 15 min | IP |
| `POST /api/auth/register` | 10 | 1 hour | IP |
| `POST /api/auth/otp/send` | 3 | 10 min | email (IP fallback) |
| `GET /api/verification/access/:token` (public) | 20 | 1 hour | IP |
| `POST /api/chat` | 20 | 1 hour | user id |

Limiters are in-memory (reset on restart) — swap to a shared store
(e.g. Redis) when running multiple instances.

## Error handling

`errorHandler.js` is the last middleware. Clients never receive stack
traces or file paths in any environment; 500s return a generic message
(plus a `detail: err.message` field outside production only). Mongo
duplicate keys → 409, validation/cast errors → 422, multer errors → 400.

## Secrets

- All credentials live in `.env` (gitignored, verified) and are read via
  `process.env.*` only — codebase grep found no hardcoded keys/passwords.
- `.env.example` contains placeholders only.
- Git history check: no `.env` file was ever committed.
- OTPs are stored bcrypt-hashed; OCR `extractedData`, Aadhaar/PAN numbers,
  and document URLs are excluded from AI chat context at the query level.

## Audited in this pass (Task 19)

- [x] CORS wildcard replaced with env-driven allowlist
- [x] helmet defaults confirmed (CSP active)
- [x] express-mongo-sanitize wired globally (Express-5-safe)
- [x] Injection spot-checks: login, OTP verify, token access, search
- [x] Rate limiters added: register (10/h/IP), verification access (20/h/IP)
- [x] Input type checks added: login, register, OTP, refresh/logout, search
- [x] Secrets audit: git history, tracked files, source grep — clean
- [x] Error handler: no stack traces/paths to clients in any environment
- [x] Cookie audit: no cookie usage anywhere (Bearer-token auth only)
- [x] Smoke test re-run after all changes — no regressions
