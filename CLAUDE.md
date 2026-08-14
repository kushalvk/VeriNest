# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VeriNest (a digital tenant verification platform) — a monorepo with two independent npm packages:

- **`backend/`** — Express 5 + Mongoose REST API, plain JavaScript, CommonJS.
- **`frontend/`** — React 19 + TypeScript SPA (Vite, Tailwind CSS, Zustand, axios).

There is no root package.json; run npm commands inside `backend/` or `frontend/`. The root `README.md` has a full API endpoint reference and data-model table; `backend/SECURITY.md` documents the security posture and should be kept updated when limits or policies change.

## Commands

### Backend (`cd backend`)

```bash
npm run dev            # nodemon on http://localhost:5000 (health: GET /api/health)
npm start              # node src/server.js
npm test               # jest unit tests under src/ only (e.g. src/services/__tests__/)
npm run test:smoke     # full E2E journey — requires local MongoDB at 127.0.0.1:27017
npx jest tests/googleAuth.e2e.test.js --runInBand           # Google sign-in E2E (also needs local MongoDB)
npx jest tests/adminUsers.e2e.test.js --runInBand           # admin user management E2E (also needs local MongoDB)
npm run seed:properties
npm run seed:demo                                           # create/reset the public guest demo accounts
npx jest tests/demoLogin.e2e.test.js --runInBand            # demo accounts E2E (also needs local MongoDB)
npx jest src/services/__tests__/trustScoreService.test.js   # single test file
npx jest -t "name substring"                                # single test by name
```

`npm test` is `jest src`, so the E2E tests under `tests/` are NOT part of it — run them explicitly. Each E2E test connects to its own dedicated throwaway database (`tenant-verification-smoke-test` / `-google-test` / `-admin-users-test` / `-demo-test`), drops it before/after, and mocks external boundaries (`emailService.sendEmail`, `googleAuthService.verifyGoogleToken`) — they never touch the dev DB, SMTP, or Google. The smoke test chains every feature in order (register → OTP → profile → property → document → OCR → admin approval → trust score → application → verification request → token access), so it's the best regression check after cross-cutting changes.

### Frontend (`cd frontend`)

```bash
npm run dev        # Vite on http://localhost:5173
npm run build      # tsc -b && vite build (type-checks — use as the TS check)
npm run lint       # oxlint (not eslint)
```

There are no frontend tests.

### Environment

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`. `MONGO_URI` is the only hard requirement to boot. Never commit `.env` files. Frontend reads `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` — both baked in at Vite build time (a deployed frontend needs a rebuild after changing them). CORS is an explicit allowlist from `ALLOWED_ORIGINS` (comma-separated origins, trailing slashes tolerated).

## Architecture

### Backend layering

Strict `routes → controllers → services → models` flow, all mounted in `src/app.js` under an `/api` router (`server.js` is just dotenv + DB connect + listen). `middlewares/errorHandler.js` must stay the last `app.use`. Cross-cutting concerns live in services (`auditService`, `notificationService`, `emailService`) and are called from controllers/other services rather than middleware.

**Express 5 gotcha:** `req.query` is a getter, so `express-mongo-sanitize` is applied manually per-object in `app.js` (sanitize in place) — do not switch to `app.use(mongoSanitize())`, it throws.

Both apps deploy to Vercel: `app.js` sets `trust proxy` to 1 so `req.ip` (used by rate-limit keyers) resolves through `X-Forwarded-For`, and the JSON body limit is 2mb because agreement signing sends a base64 signature image.

### Auth model

- JWT access token (15 min) + refresh token (7 days; only a bcrypt hash is stored in the `RefreshToken` model, with a TTL index for auto-expiry). Secrets: `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Registration requires email OTP verification (`otpService` + `emailService`).
- **Google sign-in** (`POST /api/auth/google`, `googleAuthController` + `googleAuthService`): the frontend gets an ID token via `@react-oauth/google` (`GoogleSignInButton`); the backend verifies it server-side with `google-auth-library` against audience `GOOGLE_CLIENT_ID` and requires `email_verified`. A verified Google email auto-links to an existing account by email (attaches `googleId`, keeps the password and `authProvider: "local"`); otherwise a new account is created active, email-verified, password-less, and **role-less**. `RequireAuth` forces role-less users to `/select-role`, which calls `PATCH /api/auth/set-role` — one-time only (409 if a role exists), and it revokes all refresh tokens and reissues the pair because the role is baked into JWT claims (`/auth/refresh` mints from claims, not the DB). The feature degrades gracefully when unconfigured: backend returns 503, frontend hides the button. `googleId` is `select: false` and stripped in `User.toJSON`.
- Three roles: `tenant`, `landlord`, `admin` — enforced server-side by `authMiddleware` + `roleMiddleware`, mirrored client-side by `RequireRole` in `App.tsx` (client checks are UX only; real enforcement is in the API).
- **Frontend session persistence**: the user object + refresh token are persisted to localStorage (zustand `persist`, key `verinest-auth`) so reloads keep the session for the refresh token's 7-day lifetime; the short-lived access token is memory-only. `api/client.ts` shares a single in-flight refresh promise (plain axios, to avoid interceptor recursion): the request interceptor pre-mints an access token when only the refresh token exists (post-reload), and the response interceptor retries exactly once on 401, clearing stored auth and redirecting to `/login` if the refresh fails. It also normalizes `VITE_API_BASE_URL` (strips trailing slashes, upgrades http→https for remote hosts when the page is https).

### Verification-access tokens (public share links)

Landlord verification of a tenant works via a share link `/verify/:token`: 256-bit random token from `services/tokenService.js`, only the SHA-256 hash is persisted (`VerificationRequest`), and the raw token appears once in the URL. `app.js` redacts these tokens from morgan logs. The route is public by design — access control is the token itself.

### Document pipeline

Upload (multer, memory) → magic-byte check in `utils/fileSignature.js` (never trust extension/mimetype) → Cloudinary (`cloudinaryService`, folders per type) → OCR via tesseract.js (`ocrService`) → fraud heuristics (`fraudDetectionService`) → admin review (`adminDocumentController`) → verified docs feed the trust score.

### Public demo accounts

`services/demoService.js` owns two fixed guest logins (`demo.tenant@…` / `demo.landlord@…`, `isDemo: true`, roles hardcoded to tenant/landlord so they can never be admin). They are ordinary accounts — every feature really works and really writes — but `authController.login` calls `resetDemoWorkspace()` before issuing the session whenever `user.isDemo`, which deletes everything the two accounts own and reseeds one curated snapshot. Both accounts reset together (their seeded application/verification request are shared records). `GET /api/auth/demo-accounts` serves the credentials publicly and returns `[]` until seeded. `LoginPage` reads it through the `useDemoAccounts` hook *before* rendering, because the count decides the layout: with demo accounts the page is two columns (`AuthCard`'s optional `aside` prop — `DemoLoginPanel` left, login form right, stacked form-first below `lg`), without them it stays the plain single card. Clicking a demo button fills the real email/password fields and submits them through the ordinary login path — `LoginPage` owns the credentials, the panel only calls `onUseAccount`. `AppShell` shows a demo-mode banner while `user.isDemo`. Seed/rebuild with `npm run seed:demo`.

The public property search (`searchProperties`) excludes listings owned by the demo accounts via `demoService.getDemoUserIds()` — demo fixtures are rebuilt on every demo sign-in and must not appear in the real market. `GET /properties/mine` and `GET /properties/:id` are deliberately unfiltered, so the demo landlord still manages them and the seeded applications still link to a live detail page.

### Admin user management

`adminUserController` (`/api/admin/users`, admin-only) backs the `/admin/users` page: a paginated directory of every account with name/email/phone search and role/status filters, per-user activity stats, block/unblock, and delete. Blocking is the reversible tool — it flips `accountStatus` to `blocked` (rejected by all three sign-in paths) and deletes the user's `RefreshToken` records so live sessions die within the access token's 15 minutes. Delete cascades to the records the user owns and is refused (409) while they are party to an `active` agreement; audit logs are kept and Cloudinary assets are left behind. An admin can never block or delete themselves or another admin. See `backend/SECURITY.md` for the full policy.

### Trust score

`computeTrustScore` in `services/trustScoreService.js` is pure and deterministic (no DB access) so it can be unit-tested with plain objects — keep it that way; DB fetching lives in the callers. Every score change is recorded in `TrustScoreHistory` with human-readable reasons. Recalculation triggers: admin verifies a document, a landlord rates the tenant, or an admin forces one via `/api/trust-score/recalculate/:tenantId`.

### Agreements & rental history

Landlord creates an agreement from an accepted application → `agreementPdfService` generates the PDF (pdf-lib) and uploads it to Cloudinary. Signing is identity-based only: the backend matches the caller's user id against the agreement's `tenantId`/`landlordId` to pick the signature slot (a role claim can't forge it); double-signing returns 409. When the second signature lands, the agreement flips to `active` and a `RentalHistory` record is auto-created — that's the only way one is created. Ratings are two-way (tenant↔landlord) with direction derived from the caller's identity, but only landlord→tenant ratings feed the trust score.

### Notifications & emails

`notificationService.createNotification()` is the single entry point: it always writes a `Notification` record (powers the header bell, 30s polling), and for `type: "email"` additionally sends through `emailService` using the branded HTML templates in `src/emails/templates.js` (all share the inline-CSS shell in `baseTemplate.js`; emails never carry sensitive payloads — CTAs link back via `FRONTEND_URL`). When SMTP is unconfigured outside production, emails log to console as `[DEV EMAIL]` instead of throwing; side effects (notifications, emails, audit logs, score recalcs) are wrapped so their failure never breaks the primary API action.

### Frontend routing

All routes are declared in `src/App.tsx`. A single site-wide `AppShell` (header, footer, notification bell, chat widget) wraps every route — public and authenticated alike. Authenticated pages nest under the `RequireAuth` outlet; role-specific pages wrap in `RequireRole`. Public pages include property search/detail and `/verify/:token`. API calls go through per-domain modules in `src/api/` which all use the shared `client.ts`; use `getApiError(err)` for user-facing error messages.

### Frontend imagery

Two sources, split by whether the page is selling or working.

**Photos** (`src/assets/photos.ts`) are hotlinked from the Unsplash CDN at four widths. They render through `components/Imagery.tsx`:

- `PhotoBand` — full-bleed band, layered brand gradient → photo → scrim → content. Home hero and closing CTA, property search banner, About/Services/Contact headers, dashboard greeting.
- `PhotoSplit` — text beside a photo, `side` alternating down the page. Home feature rows and the Services page.
- `AuthBackdrop` — the muted wash behind an auth card, via `AuthCard`'s `backdrop` prop. Works with the login page's two-column layout because it sits behind both columns rather than claiming one.

`PhotoLayer` removes itself on error, so the gradient (or, in `PhotoSplit`, the artwork underneath) is what actually guarantees contrast — a photo that never arrives costs nothing. Three rules learned the hard way: **opacity modifiers on the scrims must stay on Tailwind's 5-step scale** (an off-scale `/92` generates no rule at all, and the scrim then inherits the section's own opaque gradient and hides the photo, silently); auth backdrops need wide scenes, not macro shots, which blur into smudges; and a letterbox band (search, dashboard) needs a horizontal subject — anything else crops to abstraction.

**SVG** (`components/Artwork.tsx`, drawn in `currentColor` so both themes work for free). `HouseArtwork` stands in wherever content is missing: a listing with no photos, and behind every `PhotoSplit` image. A stock house passed off as a real listing would be misleading, which is why that case is illustrated rather than photographed. In-app screens other than the dashboard greeting (documents, applications, agreements, admin) and the legal pages stay image-free on purpose.

### External services

Cloudinary (file storage), Gemini via `@google/genai` (`geminiService` — chat assistant; `chatContextService` builds a context of only the caller's own data), SMTP via nodemailer (falls back gracefully when unconfigured), tesseract.js + sharp (local OCR, no API key), pdf-lib (agreement PDFs). All keyed from `backend/.env`.

## Conventions

- Backend is CommonJS (`require`/`module.exports`); frontend is ESM TypeScript. Don't mix.
- Backend error responses use the shape `{ error: "message" }` — the frontend's `getApiError` depends on it.
- Audit-worthy actions (admin decisions, verification events) should write through `auditService`.
