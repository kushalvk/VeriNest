# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VeriNest (a digital tenant verification platform) — a monorepo with two independent npm packages:

- **`backend/`** — Express 5 + Mongoose REST API, plain JavaScript, CommonJS.
- **`frontend/`** — React 19 + TypeScript SPA (Vite, Tailwind CSS, Zustand, axios).

There is no root package.json; run npm commands inside `backend/` or `frontend/`.

## Commands

### Backend (`cd backend`)

```bash
npm run dev            # nodemon on http://localhost:5000 (health: GET /api/health)
npm start              # node src/server.js
npm test               # jest unit tests under src/ (e.g. src/services/__tests__/)
npm run test:smoke     # full E2E journey — requires local MongoDB at 127.0.0.1:27017
npm run seed:properties
npx jest src/services/__tests__/trustScoreService.test.js   # single test file
npx jest -t "name substring"                                # single test by name
```

The smoke test (`tests/smoke.e2e.test.js`) connects to a dedicated throwaway database (`tenant-verification-smoke-test`), drops it before/after, and mocks `emailService.sendEmail` — it never touches the dev DB or SMTP. It chains every feature in order (register → OTP → profile → property → document → OCR → admin approval → trust score → application → verification request → token access), so it's the best regression check after cross-cutting changes.

### Frontend (`cd frontend`)

```bash
npm run dev        # Vite on http://localhost:5173
npm run build      # tsc -b && vite build (type-checks — use as the TS check)
npm run lint       # oxlint (not eslint)
```

There are no frontend tests.

### Environment

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`. `MONGO_URI` is the only hard requirement to boot. Never commit `.env` files. Frontend reads only `VITE_API_BASE_URL`.

## Architecture

### Backend layering

Strict `routes → controllers → services → models` flow, all mounted in `src/app.js` under an `/api` router (`server.js` is just dotenv + DB connect + listen). `middlewares/errorHandler.js` must stay the last `app.use`. Cross-cutting concerns live in services (`auditService`, `notificationService`, `emailService`) and are called from controllers/other services rather than middleware.

**Express 5 gotcha:** `req.query` is a getter, so `express-mongo-sanitize` is applied manually per-object in `app.js` (sanitize in place) — do not switch to `app.use(mongoSanitize())`, it throws.

### Auth model

- JWT access token (15 min) + refresh token (7 days; only a bcrypt hash is stored in the `RefreshToken` model, with a TTL index for auto-expiry). Secrets: `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Registration requires email OTP verification (`otpService` + `emailService`).
- Three roles: `tenant`, `landlord`, `admin` — enforced server-side by `authMiddleware` + `roleMiddleware`, mirrored client-side by `RequireRole` in `App.tsx` (client checks are UX only; real enforcement is in the API).
- **Frontend session persistence**: the user object + refresh token are persisted to localStorage (zustand `persist`, key `verinest-auth`) so reloads keep the session for the refresh token's 7-day lifetime; the short-lived access token is memory-only and re-minted via silent refresh after a reload. `api/client.ts` attaches the Bearer header and performs exactly one silent refresh on 401 using plain axios (to avoid interceptor recursion), then clears stored auth and redirects to `/login` on failure.

### Verification-access tokens (public share links)

Landlord verification of a tenant works via a share link `/verify/:token`: 256-bit random token from `services/tokenService.js`, only the SHA-256 hash is persisted (`VerificationRequest`), and the raw token appears once in the URL. `app.js` redacts these tokens from morgan logs. The route is public by design — access control is the token itself.

### Document pipeline

Upload (multer, memory) → magic-byte check in `utils/fileSignature.js` (never trust extension/mimetype) → Cloudinary (`cloudinaryService`, folders per type) → OCR via tesseract.js (`ocrService`) → fraud heuristics (`fraudDetectionService`) → admin review (`adminDocumentController`) → verified docs feed the trust score.

### Trust score

`computeTrustScore` in `services/trustScoreService.js` is pure and deterministic (no DB access) so it can be unit-tested with plain objects — keep it that way; DB fetching lives in the callers. Every score change is recorded in `TrustScoreHistory` with human-readable reasons.

### Frontend routing

All routes are declared in `src/App.tsx`. Authenticated pages nest under `ProtectedLayout` (shared header, notification bell, Gemini chat widget); role-specific pages wrap in `RequireRole`. Public pages (property search/detail, `/verify/:token`) render without the layout. API calls go through per-domain modules in `src/api/` which all use the shared `client.ts`; use `getApiError(err)` for user-facing error messages.

### External services

Cloudinary (file storage), Gemini via `@google/genai` (`geminiService`, chat assistant), SMTP via nodemailer (OTP emails — falls back gracefully when unconfigured), tesseract.js (local OCR, no API key). All keyed from `backend/.env`.

## Conventions

- Backend is CommonJS (`require`/`module.exports`); frontend is ESM TypeScript. Don't mix.
- Backend error responses use the shape `{ error: "message" }` — the frontend's `getApiError` depends on it.
- Audit-worthy actions (admin decisions, verification events) should write through `auditService`.
