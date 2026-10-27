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
npm run migrate:property-verification                       # one-off: grandfather pre-existing listings as verified
npm run migrate:property-verification -- --pending          # …or force them through review (hidden until a bill is uploaded)
npx jest tests/demoLogin.e2e.test.js --runInBand            # demo accounts E2E (also needs local MongoDB)
npx jest src/services/__tests__/trustScoreService.test.js   # single test file
npx jest src/services/__tests__/propertyVerificationService.test.js   # tax-bill auto-check helpers
npx jest -t "name substring"                                # single test by name
```

`npm test` is `jest src`, so the E2E tests under `tests/` are NOT part of it — run them explicitly. Each E2E test connects to its own dedicated throwaway database (`tenant-verification-smoke-test` / `-google-test` / `-admin-users-test` / `-demo-test`), drops it before/after, and mocks external boundaries (`emailService.sendEmail`, `googleAuthService.verifyGoogleToken`) — they never touch the dev DB, SMTP, or Google. The smoke test chains every feature in order (register → OTP → profile → property → document → OCR → admin approval → trust score → application → verification request → token access), so it's the best regression check after cross-cutting changes. **There is no automated coverage yet for the agreement end/rating lifecycle or for landlord property verification** — verify them manually (see "Agreement lifecycle" and "Landlord property verification" below) and extend the smoke test if you touch them. The smoke test, `seed:properties` and `demoService` all predate property verification: they create properties that now start `not_submitted` (hidden from tenants), so they must be updated (see Gotchas) before the smoke test is trustworthy again.

### Frontend (`cd frontend`)

```bash
npm run dev        # Vite on http://localhost:5173
npm run build      # tsc -b && vite build (type-checks — use as the TS check)
npm run lint       # oxlint (not eslint)
```

There are no frontend tests.

### Environment

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`. `MONGO_URI` is the only hard requirement to boot. Never commit `.env` files. Frontend reads `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` — both baked in at Vite build time (a deployed frontend needs a rebuild after changing them). CORS is an explicit allowlist from `ALLOWED_ORIGINS` (comma-separated origins, trailing slashes tolerated). Optional: `TAX_BILL_OCR_LANG` (tesseract language(s) for house tax bills, default `eng`; use `eng+guj` for Gujarati bills — slower, downloads extra language data on first use).

## Architecture

### Backend layering

Strict `routes → controllers → services → models` flow, all mounted in `src/app.js` under an `/api` router. `server.js` is dotenv + DB connect (with retry) + listen, and **starts the hourly auto-end-agreements job once the DB is connected** (`startAutoEndJob`; `setInterval`, `unref`'d). The serverless entry (`api/index.js`) does not run that job. `middlewares/errorHandler.js` must stay the last `app.use`. Cross-cutting concerns live in services (`auditService`, `notificationService`, `emailService`, `rentalRecordService`) and are called from controllers/other services rather than middleware.

**Express 5 gotcha:** `req.query` is a getter, so `express-mongo-sanitize` is applied manually per-object in `app.js` (sanitize in place) — do not switch to `app.use(mongoSanitize())`, it throws.

Both apps deploy to Vercel: `app.js` sets `trust proxy` to 1 so `req.ip` (used by rate-limit keyers) resolves through `X-Forwarded-For`, and the JSON body limit is 2mb because agreement signing sends a base64 signature image.

### Auth model

- JWT access token (15 min) + refresh token (7 days; only a bcrypt hash is stored in the `RefreshToken` model, with a TTL index for auto-expiry). Secrets: `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Registration requires email OTP verification (`otpService` + `emailService`).
- **Google sign-in** (`POST /api/auth/google`, `googleAuthController` + `googleAuthService`): the frontend gets an ID token via `@react-oauth/google` (`GoogleSignInButton`); the backend verifies it server-side with `google-auth-library` against audience `GOOGLE_CLIENT_ID` and requires `email_verified`. A verified Google email auto-links to an existing account by email (attaches `googleId`, keeps the password and `authProvider: "local"`); otherwise a new account is created active, email-verified, password-less, and **role-less**. `RequireAuth` forces role-less users to `/select-role`, which calls `PATCH /api/auth/set-role` — one-time only (409 if a role exists), and it revokes all refresh tokens and reissues the pair because the role is baked into JWT claims (`/auth/refresh` mints from claims, not the DB). The feature degrades gracefully when unconfigured: backend returns 503, frontend hides the button. `googleId` is `select: false` and stripped in `User.toJSON`.
- Three roles: `tenant`, `landlord`, `admin` — enforced server-side by `authMiddleware` + `roleMiddleware`, mirrored client-side by `RequireRole` in `App.tsx` (client checks are UX only; real enforcement is in the API).
- `middlewares/optionalAuthMiddleware.js` populates `req.user` when a valid Bearer token is present and otherwise lets the request through anonymously — it never rejects. It is used only on the public `GET /properties/:id` so owners/admins can open unverified listings. It must read the **same JWT claim shape as `authMiddleware`** (`id`, `role`); if `authMiddleware`'s payload handling changes, change both.
- **Frontend session persistence**: the user object + refresh token are persisted to localStorage (zustand `persist`, key `verinest-auth`) so reloads keep the session for the refresh token's 7-day lifetime; the short-lived access token is memory-only. `api/client.ts` shares a single in-flight refresh promise (plain axios, to avoid interceptor recursion): the request interceptor pre-mints an access token when only the refresh token exists (post-reload), and the response interceptor retries exactly once on 401, clearing stored auth and redirecting to `/login` if the refresh fails. It also normalizes `VITE_API_BASE_URL` (strips trailing slashes, upgrades http→https for remote hosts when the page is https).

### Verification-access tokens (public share links)

Landlord verification of a tenant works via a share link `/verify/:token`: 256-bit random token from `services/tokenService.js`, only the SHA-256 hash is persisted (`VerificationRequest`), and the raw token appears once in the URL. `app.js` redacts these tokens from morgan logs. The route is public by design — access control is the token itself.

### Document pipeline

Upload (multer, memory) → magic-byte check in `utils/fileSignature.js` (never trust extension/mimetype) → Cloudinary (`cloudinaryService`, folders per type) → OCR via tesseract.js (`ocrService`) → fraud heuristics (`fraudDetectionService`) → admin review (`adminDocumentController`) → verified docs feed the trust score.

### Landlord property verification (house tax bill)

The mirror image of tenant document verification: a landlord must upload a house tax bill for each property, an admin approves it, and only then is the listing visible to tenants. Verification is **per property, not per landlord**.

**Model.** `Property.verification` (never client-writable):

- `status`: `not_submitted` (default) → `pending` → `verified` | `rejected`. `grandfathered` marks listings that predate the feature (set by the migration script).
- `taxBill { publicId, url, uploadedAt }`, `attempts` (capped at `MAX_ATTEMPTS = 5` → 403), `reviewedBy`, `reviewedAt`, `rejectionReason`.
- `ocr { status: not_started|done|failed, rawText (≤ 8000 chars), confidence, extracted { ownerName, propertyTaxId, billYear, amount } }`.
- `autoChecks { ownerNameMatch, addressMatch (0–100 or null), billYearValid (true/false/null), duplicateBill, lowOcrConfidence }` — **advisory only**; nothing is ever auto-approved or auto-rejected from them.
- Indexes serve tenant search (`verification.status` + `status` + city + rent), the admin queue, and the duplicate-bill lookup on `verification.ocr.extracted.propertyTaxId`.

**Landlord flow.** `POST /properties` creates the listing as `not_submitted` (JSON, unchanged) → `POST /properties/:id/tax-bill` (multipart field **`taxBill`**, owner only, `taxBillUploadMiddleware`) does: JPG/PNG only (`ALLOWED_BILL_MIME`; tesseract.js can't read PDFs) + magic-byte check → Cloudinary (`FOLDERS.taxBills`, falling back to `${FOLDERS.properties}-tax-bills`) → OCR (`ocrService.extractText(url, TAX_BILL_OCR_LANG)` + `parseTaxBillFields`, best effort — an OCR failure never blocks submission) → `buildAutoChecks` → status `pending`. The same endpoint is the re-upload path after a rejection (and may replace a bill while still `pending`); it returns 409 once `verified`. The frontend's "Add property" form does both calls in sequence; if the bill upload fails the listing exists but stays hidden, and the card's `PropertyVerificationPanel` lets the landlord retry.

**Admin flow.** `adminPropertyController` + `adminPropertyRoutes` (`/api/admin/properties`, admin-only): `GET ?status=pending|verified|rejected` (pending is FIFO by bill upload time; others newest-reviewed first; returns per-status `counts` for the tabs and populates `landlordId`) and `PATCH /:id { status: verified|rejected, remarks }` (remarks required, ≥ 3 chars, when rejecting). The decision is an **atomic `findOneAndUpdate` guarded on `verification.status: 'pending'`** — two admins can't both decide, and a non-pending property returns 409. Side effects (in-app `push` notification to the landlord, `auditService` actions `property_tax_bill_upload` / `property_verification_update`) are wrapped so their failure never breaks the decision. No email template exists for this yet.

**Visibility rules (the part that must not regress).**

- `searchProperties` hard-codes `{ status: 'available', 'verification.status': 'verified' }`, never client-overridable, and selects away `taxBill`, `ocr`, `autoChecks`, `reviewedBy`, `rejectionReason`, `attempts` (`PUBLIC_HIDE`).
- `GET /properties/:id` returns 404 for a non-verified listing unless the caller is its owner or an admin (via `optionalAuth`). `shape(property, viewer)` trims the response per viewer: `public` (status only), `owner` (+ bill URL, rejection reason, attempts; no OCR/autoChecks), `admin` (everything).
- `GET /properties/mine` returns every status to the owner, minus `ocr` and `autoChecks`.
- `sanitizeBody` strips `landlordId` and **every `verification` / `verification.*` key** from request bodies, so a landlord can never self-verify through `POST`/`PUT`. Never write `verification.*` from request input anywhere else.
- `updateProperty`: when `REVERIFY_ON_ADDRESS_CHANGE` is true and a **verified** listing's address changes, it drops back to `pending` (or `not_submitted` if no bill is on file), clears the review fields and recomputes `autoChecks`. The response includes `reverification: boolean`.

**Auto-checks** (`services/propertyVerificationService.js`): `tokenCoverage` is an order-insensitive % of the entered tokens (≥ 3 chars) found in the OCR text — the landlord's `User.fullName` and the entered address are compared against the **whole OCR text**, not brittle field extraction. `isRecentBillYear` accepts the current or previous Indian financial year (April start). `isDuplicateBill` flags the same `propertyTaxId` on another property. `lowOcrConfidence` is confidence < 40 or empty text. The pure helpers are unit-tested in `src/services/__tests__/propertyVerificationService.test.js` — keep them DB-free like `computeTrustScore`.

**Rollout.** Existing documents have no `verification` field. `npm run migrate:property-verification` (`src/scripts/migratePropertyVerification.js`) sets those to `verified` + `grandfathered` (default) or `not_submitted` (`--pending`), then ensures indexes. Run it after deploying the model change and after any seeding that bypasses the new flow.

### Public demo accounts

`services/demoService.js` owns two fixed guest logins (`demo.tenant@…` / `demo.landlord@…`, `isDemo: true`, roles hardcoded to tenant/landlord so they can never be admin). They are ordinary accounts — every feature really works and really writes — but `authController.login` calls `resetDemoWorkspace()` before issuing the session whenever `user.isDemo`, which deletes everything the two accounts own and reseeds one curated snapshot. Both accounts reset together (their seeded application/verification request are shared records). `GET /api/auth/demo-accounts` serves the credentials publicly and returns `[]` until seeded. `LoginPage` reads it through the `useDemoAccounts` hook *before* rendering, because the count decides the layout: with demo accounts the page is two columns (`AuthCard`'s optional `aside` prop — `DemoLoginPanel` left, login form right, stacked form-first below `lg`), without them it stays the plain single card. Clicking a demo button fills the real email/password fields and submits them through the ordinary login path — `LoginPage` owns the credentials, the panel only calls `onUseAccount`. `AppShell` shows a demo-mode banner while `user.isDemo`. Seed/rebuild with `npm run seed:demo`.

The public property search (`searchProperties`) excludes listings owned by the demo accounts via `demoService.getDemoUserIds()` — demo fixtures are rebuilt on every demo sign-in and must not appear in the real market. `GET /properties/mine` is deliberately unfiltered, so the demo landlord still manages them. `GET /properties/:id` is now 404 for unverified listings to everyone except the owner/admin, so **the demo seed must create its properties already `verification.status: 'verified'`** or the demo tenant's seeded application will link to a "not found" page (see Gotchas — not done yet).

### Admin user management

`adminUserController` (`/api/admin/users`, admin-only) backs the `/admin/users` page: a paginated directory of every account with name/email/phone search and role/status filters, per-user activity stats, block/unblock, and delete. Blocking is the reversible tool — it flips `accountStatus` to `blocked` (rejected by all three sign-in paths) and deletes the user's `RefreshToken` records so live sessions die within the access token's 15 minutes. Delete cascades to the records the user owns and is refused (409) while they are party to an `active` agreement; audit logs are kept and Cloudinary assets are left behind. An admin can never block or delete themselves or another admin. See `backend/SECURITY.md` for the full policy.

### Trust score

`computeTrustScore` in `services/trustScoreService.js` is pure and deterministic (no DB access) so it can be unit-tested with plain objects — keep it that way; DB fetching lives in the callers. Every score change is recorded in `TrustScoreHistory` with human-readable reasons. Recalculation triggers: admin verifies a document, a landlord rates the tenant, or an admin forces one via `/api/trust-score/recalculate/:tenantId`. Property/landlord verification does **not** feed the (tenant) trust score.

### Agreements & signing

Landlord creates an agreement from an accepted application → `agreementPdfService` generates the PDF (pdf-lib) and uploads it to Cloudinary. Signing is identity-based only: the backend matches the caller's user id against the agreement's `tenantId`/`landlordId` to pick the signature slot (a role claim can't forge it); double-signing returns 409. When the second signature lands, the agreement flips to `active`, `signedAt` is stamped, a `RentalHistory` record is created (`rentalHistoryController.createRentalRecord`), and the property goes `occupied`.

The `Agreement` model (`models/Agreement.js`) owns the lifecycle vocabulary — use its helpers instead of hand-setting fields:

- `status`: `draft` → `active` ⇄ `end_requested` → `completed` | `terminated` (the old `ended` value no longer exists).
- Flags/timestamps: `tenantSigned`, `landlordSigned`, `tenantSignedAt`, `landlordSignedAt`, `signedAt` (= activation time). There is no `signatures` object and no `activatedAt`.
- `endRequests[]` (sub-schema): `requestedBy`, `requestedByRole`, `reason`, `status` (`pending|approved|rejected|cancelled`), `requestedAt`, `respondedAt`, `responseNote`. History is kept; only a `pending` entry is "live".
- `endType`: `natural` | `early_approved`; `endedAt`; `tenantRated` / `landlordRated`.
- Methods/virtuals: `getRoleOf(userId)` → `'tenant' | 'landlord' | null`, `signAs(role)` (sets flag + time, activates when both signed), `finalize(endType)` (`natural` → `completed`, `early_approved` → `terminated`, sets `endedAt`), virtuals `pendingEndRequest`, `isEnded`, `isFullySigned`.

### Agreement lifecycle (ending a tenancy)

Backend: `agreementLifecycleController` (routes in `agreementRoutes.js`, all behind `authMiddleware`; party checks are by identity in the controller). Endpoints:

- `GET /agreements/mine/lifecycle` — enriched list for the Agreements page. Per agreement it returns `myRole`, `counterparty`, `endRequests` summary and **server-computed action flags**: `canInitiateEnd`, `isEarlyEnd`, `canRespondEndRequest`, `canCancelEndRequest`, `canRate`, `iRated`, `myRating`. The frontend must not re-derive these rules.
- `PATCH /agreements/:id/end` — after `endDate`: `finalize('natural')` immediately; before it: requires `reason` (≥ 5 chars), pushes an end request, sets `end_requested`, emails the other party. 409 if one is already pending.
- `PATCH /agreements/:id/end/respond` `{ action: approve|reject }` — only the party who did **not** raise the pending request may respond. Approve → `finalize('early_approved')` (`terminated`); reject → back to `active`.
- `PATCH /agreements/:id/cancel-end-request` — only the requester; back to `active`.
- `POST /agreements/:id/rate` — handled by `agreementRatingController` (see below).

Route-order rule: `/mine` and `/mine/lifecycle` must stay registered **before** `/:id`. A duplicate or dangling `/:id/rate` line (pointing at a function that no longer exists) crashes boot — keep exactly one. The same rule applies in `propertyRoutes.js`: `/mine` is registered before `/:id`, and `POST /:id/tax-bill` sits with the other owner-only routes.

**When an agreement ends** (natural end, approved early end, the auto-end job): call `rentalRecordService.syncRentalRecord(agreement)`. It is idempotent and never throws: upserts the `RentalHistory` record (`agreementId` is unique), sets `moveOutDate` (the `endDate` for natural ends, else `endedAt`), and flips the property `occupied → available` unless another `active`/`end_requested` agreement still holds it. `backfillRecordsForUser(userId)` runs at the start of `GET /rental-history/mine` and repairs any active/ended agreement missing its record or `moveOutDate`.

**Auto-end job** (`src/cron/autoEndAgreements.js`, started from `server.js`): finds `active`/`end_requested` agreements with `endDate <= now` and both parties signed, claims each with an atomic `findOneAndUpdate` (status → `completed`, `endType: natural`), cancels any pending end request via `arrayFilters`, calls `syncRentalRecord`, and notifies both parties. It is best-effort and logs `[cron] …`.

### Rental history & ratings

Ratings are **embedded in `RentalHistory`**, not a separate collection: `tenantRating`/`tenantReview` = what the landlord said about the tenant; `landlordRating`/`landlordReview` = what the tenant said about the landlord. Direction always comes from the caller's identity; one rating per side; only after the rental ended (`moveOutDate` set / agreement `completed`|`terminated`); duplicates → 409. Only landlord→tenant ratings call `trustScoreService.recalculateAndPersist(tenantId, 'System')` (wrapped, failures logged). The rated party gets a `ratingReceived` notification.

Two entry points write the same fields — never call both for one rental:

- `POST /agreements/:id/rate` (`agreementRatingController.rateAgreement`) — used by the Agreements page popup. Its `ensureRecord` creates/completes the `RentalHistory` row on demand, then sets the rating, mirrors `tenantRated`/`landlordRated` on the agreement, and returns the real error message if record creation fails.
- `PATCH /rental-history/:id/rate` (`rentalHistoryController.submitRating`) — used by the Rental history page's rating form; requires `moveOutDate`.

`PATCH /rental-history/:id/complete` is landlord-only and **refuses (409) while the agreement is still `active`/`end_requested` and before its `endDate`** — early endings must go through the Agreements page so the other party's approval can't be bypassed. When allowed it sets `moveOutDate`, marks the agreement `completed` (`endType: natural`), cancels pending end requests, and relists the property.

Legacy: a standalone `Rating` model / `ratingController` / `User.ratingAvg` aggregate from an earlier design may still exist in the repo but is **not part of the live flow** — don't build on it; the trust score reads ratings from `RentalHistory`.

### Notifications & emails

`notificationService.createNotification()` is the single entry point: it always writes a `Notification` record (powers the header bell, 30s polling), and for `type: "email"` additionally sends through `emailService` using the branded HTML templates in `src/emails/templates.js` (all share the inline-CSS shell in `baseTemplate.js`; emails never carry sensitive payloads — CTAs link back via `FRONTEND_URL`). Lifecycle templates include `agreementEndRequested`, `agreementEnded` and `ratingReceived`; a controller referencing a `templateName` that doesn't exist in `templates.js` will fail to render its email, so add the template when adding a new notification. When SMTP is unconfigured outside production, emails log to console as `[DEV EMAIL]` instead of throwing; side effects (notifications, emails, audit logs, score recalcs, rental-record sync) are wrapped so their failure never breaks the primary API action. Property verification decisions currently use in-app `type: 'push'` notifications only.

**Import-shape gotcha:** `notificationService` is imported inconsistently in the codebase (`{ notificationService }` vs the module itself). New code should use `const mod = require('../services/notificationService'); const notificationService = mod.notificationService || mod;`, and a wrongly-shaped import fails silently because callers wrap it in try/catch.

### Frontend routing

All routes are declared in `src/App.tsx`. A single site-wide `AppShell` (header, footer, notification bell, chat widget) wraps every route — public and authenticated alike. Authenticated pages nest under the `RequireAuth` outlet; role-specific pages wrap in `RequireRole`. Public pages include property search/detail and `/verify/:token`. API calls go through per-domain modules in `src/api/` which all use the shared `client.ts`; use `getApiError(err)` for user-facing error messages. There is no `src/types/` folder — API types live next to their calls (e.g. `Property` and `PropertyVerification` in `api/propertyApi.ts`).

`pages/ActiveAgreementsPage.tsx` is the shared tenant+landlord **Agreements page** (tabs: Active / End requests / Ended). It renders only what `listMyAgreementsLifecycle()` returns and the action flags in it, runs end/approve/reject/cancel through one `runAction` helper (notice banner + silent reload), and hosts the end-agreement and rating popups inline. Ended agreements show **Rate tenant/landlord** (`canRate`) or **Already rated ★** (`iRated` + `myRating`). `pages/RentalHistoryPage.tsx` shows both ratings per record, keeps its own rating form, and handles a `?rate=<agreementId>` deep link (find the record by `agreementId`, open the form, or show "already rated"). The frontend `RentalRecord` type carries `agreementId: string`; the page's `getAgreementId()` helper also tolerates a populated `{ _id }`. When adding fields to the lifecycle response, update `LifecycleAgreement` in `src/api/agreementApi.ts` too.

**Property verification UI.**

- `pages/LandlordPropertiesPage.tsx` — the create form has a required house-tax-bill file input (`checkFile`: JPG/PNG), creates the property then calls `uploadTaxBill`; editing a verified listing shows a re-verification warning. Each card is followed by `components/PropertyVerificationPanel.tsx` (status badge, rejection reason, link to the uploaded bill, upload/replace button). The page's banner scrolls into view whenever it is set (`bannerRef` + effect, `scroll-mt-24` for the sticky header) because the triggering buttons can be far below it.
- `pages/AdminPropertiesPage.tsx` (route `/admin/properties`, header link "Property Review") — pending/verified/rejected tabs with counts, opening `components/AdminPropertyReviewModal.tsx`: bill image, entered-vs-OCR fields, advisory chips from `utils/propertyVerification.ts` (`autoCheckChips`: ≥ 70 green, ≥ 40 amber, else red), approve, and reject-with-reason. API calls are in `api/adminPropertyApi.ts`.
- `pages/PropertyDetailPage.tsx` — "Verified owner" badge, an owner/admin-only "not verified yet" notice, and Apply hidden unless the listing is verified. `PropertyCard` has no verified badge yet.

### Frontend imagery

Two sources, split by whether the page is selling or working.

**Photos** (`src/assets/photos.ts`) are hotlinked from the Unsplash CDN at four widths. They render through `components/Imagery.tsx`:

- `PhotoBand` — full-bleed band, layered brand gradient → photo → scrim → content. Home hero and closing CTA, property search banner, About/Services/Contact headers, dashboard greeting.
- `PhotoSplit` — text beside a photo, `side` alternating down the page. Home feature rows and the Services page.
- `AuthBackdrop` — the muted wash behind an auth card, via `AuthCard`'s `backdrop` prop. Works with the login page's two-column layout because it sits behind both columns rather than claiming one.

`PhotoLayer` removes itself on error, so the gradient (or, in `PhotoSplit`, the artwork underneath) is what actually guarantees contrast — a photo that never arrives costs nothing. Three rules learned the hard way: **opacity modifiers on the scrims must stay on Tailwind's 5-step scale** (an off-scale `/92` generates no rule at all, and the scrim then inherits the section's own opaque gradient and hides the photo, silently); auth backdrops need wide scenes, not macro shots, which blur into smudges; and a letterbox band (search, dashboard) needs a horizontal subject — anything else crops to abstraction.

**SVG** (`components/Artwork.tsx`, drawn in `currentColor` so both themes work for free). `HouseArtwork` stands in wherever content is missing: a listing with no photos, and behind every `PhotoSplit` image. A stock house passed off as a real listing would be misleading, which is why that case is illustrated rather than photographed. In-app screens other than the dashboard greeting (documents, applications, agreements, admin) and the legal pages stay image-free on purpose.

### External services

Cloudinary (file storage), Gemini via `@google/genai` (`geminiService` — chat assistant; `chatContextService` builds a context of only the caller's own data), SMTP via nodemailer (falls back gracefully when unconfigured), tesseract.js + sharp (local OCR, no API key; also reads house tax bills), pdf-lib (agreement PDFs). All keyed from `backend/.env`.

## Conventions

- Backend is CommonJS (`require`/`module.exports`); frontend is ESM TypeScript. Don't mix.
- Backend error responses use the shape `{ error: "message" }` — the frontend's `getApiError` depends on it.
- Audit-worthy actions (admin decisions, verification events) should write through `auditService`.
- Authorization is by **identity** (compare `req.user.id` to the record's `tenantId`/`landlordId`), never by a client-supplied role or direction. Use `agreement.getRoleOf(req.user.id)`.
- Use the `Agreement` helpers (`signAs`, `finalize`) for status changes; don't set `status`/`endType`/`endedAt` by hand in new code, and use `syncRentalRecord` rather than creating `RentalHistory` rows ad hoc.
- Don't call `.save()` on `.lean()` results; for concurrent transitions (end/auto-end, property verification decisions) use atomic `findOneAndUpdate` with a status guard.
- Mongoose `pre('validate')` hooks should throw synchronously rather than rely on a `next` callback (works across Mongoose versions).
- Anything that lists, searches or returns properties to a non-owner must go through the verified-only rules in "Landlord property verification" — add the `verification.status: 'verified'` filter (or the `shape()` viewer trimming) rather than relying on the frontend to hide things.

## Gotchas

- **Stale unique indexes.** Mongoose never drops indexes when a schema changes. A leftover unique index from an old field name (e.g. `agreement_1` on `rentalhistories`) makes every new insert fail with `E11000 … dup key: { agreement: null }` once one document holds `null`. When renaming fields, drop the old index (`db.<collection>.dropIndex('<name>')`). `rentalhistories` should have exactly `_id_`, `tenantId_1`, `landlordId_1`, `agreementId_1` (unique). Don't swallow `E11000` blindly in create paths — confirm the document actually exists first (as `syncRentalRecord` does).
- **Old data shapes.** Records created before the lifecycle feature may use status `ended`, `signatures`/`activatedAt`, or end requests with `requester`/`target`. Migrate them before saving through the new schema (enum validation fails otherwise). Likewise, properties created before property verification have no `verification` field and are invisible to tenants until `npm run migrate:property-verification` has run.
- **Collection names** (for mongosh): `agreements`, `rentalhistories`, `properties`, `users`, `notifications` (Mongoose pluralizes lowercase model names).
- **Auto-end job on Vercel.** It is a `setInterval` in `server.js`, so it only runs on a long-lived Node process; on serverless the manual End button (allowed after `endDate`) is the path.
- **Tax bills are JPG/PNG only.** tesseract.js can't OCR PDFs; the upload endpoint and `checkFile` both reject them. Supporting PDFs needs a PDF→image step first. OCR is English-only unless `TAX_BILL_OCR_LANG` is set.
- **Multipart field names are contracts.** `taxBill` (tax bill), `images` (property images), `file` (tenant documents) — the multer middleware and the frontend `FormData` calls must agree.

### Known gaps in property verification (not done yet)

- **Applications aren't gated.** The apply endpoint (`applicationController`) does not yet reject properties whose `verification.status !== 'verified'`; only the UI hides the button, so a direct API call can still apply to an unverified listing.
- **Seeds, demo and smoke test predate the feature.** `seed:properties`, `demoService.resetDemoWorkspace` and `tests/smoke.e2e.test.js` create properties that default to `not_submitted`. Mark seeded/demo properties `verification: { status: 'verified', grandfathered: true }` and make the smoke test upload a bill + approve it as admin (the smoke test currently fails at the search/apply step).
- **Tax bills sit on a public Cloudinary URL.** The URL is stripped from every non-owner/non-admin response, but the asset itself is not access-restricted. Authenticated/private delivery needs `cloudinaryService` changes (and a `FOLDERS.taxBills` entry).
- **`PropertyCard` has no verified badge**, and decisions don't send an email (in-app notification only).