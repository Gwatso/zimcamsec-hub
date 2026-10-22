# Zimcamsec Hub — Architecture

> Heritage-Based Curriculum resource portal for Zimbabwean learners (17 and under),
> verified educators and a Master Admin. This document records *what* was built,
> *why*, and the trade-offs behind it.

## 1. Requirements analysis

| Spec requirement | What it really demands | How it's met |
| --- | --- | --- |
| Live download counters ("social proof") | A **shared, server-side** count all visitors see; resistant to inflation | Postgres counter + per-user-per-day de-duplication table; batched polling API |
| Learner gate (17 and under) | Real accounts, age rule enforced server-side, safeguarding | DB-backed sessions, DOB validation in Harare time, guardian e-mail under 13 |
| Preview guardrail (2 pages for guests) | Rest of the document must **never reach** the guest in the viewer | Server generates a separate 2-page PDF at upload time; full in-app view requires a session |
| Guest downloads (1 file a day without an account) | Allowance tracked server-side, fair on shared networks | `guest_downloads` table keyed by a random `zch_guest` cookie + Harare day; see §5.2a |
| Teacher-only content (EC No. & school) | Verification workflow, not just a checkbox | `teacher_status` pending → verified by admin; access policy is a pure, tested function |
| Data-Saver & offline | Minimal bytes on 2G/3G; content usable with no signal | SSR honours Data-Saver/`Save-Data`; pdf.js range loading; service worker; explicit "Save for offline" |
| Support desk → edu.novacacia@gmail.com | Messages must never be lost, even if e-mail fails | Persist ticket first, then e-mail via Resend; admin queue with retry |
| Admin error logs & metrics | Errors from *all* users, not one browser's localStorage | `error_logs` table fed by server hook + client telemetry beacon |

### Why not the stack in the original spec (Vite SPA + localStorage)?

The original document describes a client-only React SPA storing users, counters and logs in
`localStorage`. That cannot satisfy its own requirements: counters in `localStorage` are per-device
(not social proof), a client-side page limit is bypassed with DevTools, "accounts" in
`localStorage` provide no security, and an admin cannot see other users' errors. We therefore keep
the spec's **UX, branding and feature set** (React, TypeScript, Tailwind, Lucide, heritage green
`#4F7942` / gold `#D4AF37`, dark mode, port 3000) but move the authority to a server.

## 2. Tech stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript (strict)** | SSR sends usable HTML on the first byte (vital on slow links); Server Actions give forms that work *without JavaScript*; one deployable. 15.5.x is the maintained LTS-style line; see §11 for the Next 16 upgrade path. |
| Styling | **Tailwind CSS v4**, system fonts | Zero font downloads; ~no runtime CSS cost. |
| Database | **PostgreSQL** via `pg`, or embedded **PGlite** (Postgres-in-WASM) when `DATABASE_URL` is unset | Same SQL everywhere; zero-setup dev and single-box school installs. Full-text search, partial indexes, generated columns. |
| Query layer | **Drizzle ORM** | Type-safe, thin, no code generation or engine binaries. |
| Auth | Hand-rolled: scrypt + opaque DB sessions | ~150 lines, no dependency; instant revocation. |
| PDFs | **pdf-lib** (server: validate, count, build preview), **pdf.js legacy build** (client rendering, older Android browsers) | Lazy-loaded; only rendered pages' byte ranges are fetched. |
| Validation | **zod** | One schema set shared by forms, actions and route handlers. |
| E-mail | Resend HTTP API via `fetch` | No SDK; adapter is 40 lines. |
| Tests | **Vitest** (unit + PGlite integration) | Real Postgres semantics in tests without Docker. |

Runtime dependencies: 11. No UI kit, no state library, no chart library, no PWA plugin, no auth library.

## 3. Folder structure

```
.
├── docs/ARCHITECTURE.md          ← this file
├── public/
│   ├── sw.js                     service worker (hand-written)
│   ├── icon.svg
│   └── pdf.worker.min.mjs        copied from pdfjs-dist on install (gitignored)
├── scripts/copy-pdf-worker.mjs
├── src/
│   ├── middleware.ts             edge: optimistic auth redirect + sliding session cookie
│   ├── instrumentation.ts        boot-time DB warm-up + global onRequestError → error_logs
│   ├── app/                      routes (UI only: fetch via services, render components)
│   │   ├── page.tsx              home
│   │   ├── resources/            catalogue + [slug] detail/viewer
│   │   ├── curriculum/           tier map + [tier] pages (incl. policy hub)
│   │   ├── auth/                 sign-in, register
│   │   ├── account/              profile, history, offline library
│   │   ├── support/  about/  offline/
│   │   ├── admin/                overview, resources(+new), users, support, logs
│   │   ├── api/                  resources/[id]/file, resources/[id]/cover,
│   │   │                         resources/counts, telemetry, health
│   │   └── error.tsx, global-error.tsx, not-found.tsx, sitemap.ts, robots.ts, manifest.ts
│   ├── actions/                  Server Actions ("use server"): auth, support, preferences, admin
│   ├── components/               presentational + client islands (viewer, counters, forms…)
│   ├── lib/                      isomorphic, pure, unit-tested domain logic
│   │   ├── curriculum.ts         HBC taxonomy (tiers, levels, subjects, resource types)
│   │   ├── access.ts             THE access policy (guest / learner / teacher / admin)
│   │   ├── validation.ts         zod schemas
│   │   ├── dates.ts search.ts format.ts safe-redirect.ts cookies.ts form-state.ts
│   │   └── client/               browser-only: live-counts store, offline docs, telemetry
│   └── server/                   server-only infrastructure & services
│       ├── db/                   client (pg | PGlite), schema, migrations, migrate, seed, cli
│       ├── auth/                 password (scrypt), session, guards
│       ├── services/             resources, downloads, users, support, admin-resources, metrics, error-logs
│       ├── storage.ts pdf.ts mail.ts logger.ts rate-limit.ts request.ts http.ts env.ts preferences.ts
└── tests/                        unit + integration (PGlite in-memory)
```

**Layering rule:** `app/` → `actions/` → `server/services/` → `server/db` / infra. `lib/` is
dependency-free and shared by both sides. Services never import from `app/` or `components/`.

## 4. Data model

```
users ──< sessions                         (token SHA-256 is the PK)
  │
  ├──< resource_events >── resources       (every view/download; history + metrics)
  └──< resource_daily_uniques >── resources (PK resource,user,day → counter de-dupe)
guest_downloads >── resources            (PK guest cookie id, day, resource → guest allowance)
support_tickets (reference ZCH-XXXXXX, delivery_status)
error_logs (source server|client, fingerprint)
schema_migrations
```

Key constraints live in SQL (`src/server/db/migrations.ts`): lower-case unique e-mail, unique EC
number, role-specific CHECKs (learner ⇒ DOB; teacher ⇒ EC No. + school + status), unique file
checksum (duplicate uploads rejected), generated `tsvector` search column with GIN index, partial
indexes on published rows.

## 5. Data flows

### 5.1 Guest opens a resource

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as Next.js (SSR)
  participant F as /api/resources/:id/file
  participant S as Storage
  B->>N: GET /resources/o-level-maths-p1
  N->>N: getCurrentUser() → null; resolveAccess(null, public) → previewPages=2
  N-->>B: HTML (metadata, counter, sign-in CTA, viewer island)
  B->>F: GET ?mode=preview  (pdf.js, lazy-loaded)
  F->>F: re-check access (never trust the page)
  F->>S: stream previews/<sha>-p2.pdf (Range-aware)
  F-->>B: 2-page PDF (public, cacheable, ETag)
  B->>B: render pages as they scroll into view → "end of preview" gate
```

### 5.2 Signed-in download & live counter

1. `GET /api/resources/:id/file?mode=download` → session + access check.
2. If the request is the *first* of a logical open (no `Range`, or `Range` from byte 0), a
   transaction inserts a `resource_events` row and `INSERT … ON CONFLICT DO NOTHING` into
   `resource_daily_uniques`; only when that insert succeeds is `download_count` incremented.
3. The file streams with `Content-Disposition: attachment`.
4. The client calls `refreshSoon()` → `/api/resources/counts?ids=…&fresh=1` and the badge animates.
5. Other visitors' badges update via **one** batched poll per tab (45 s; paused when hidden,
   offline or in Data-Saver). Counts are CDN-cacheable for 10–20 s.

### 5.2a Guest download (no account)

1. `GET /api/resources/:id/file?mode=download` without a session, for a public resource.
2. The route reads the `zch_guest` cookie (random 128-bit id) or mints one, checks the file
   exists, then calls `claimGuestDownload()`: under a per-guest advisory lock it applies
   `guestDownloadDecision()` (`GUEST_DAILY_DOWNLOADS` = 1 new file per Harare day; the same
   file again is free, so retries and Range resumes work). A new file inserts a
   `guest_downloads` row, logs an anonymous `resource_events` row and bumps `download_count`.
3. Refused: browser navigations get a 303 back to the resource page (which explains the limit);
   other clients get `403 guest_limit_reached`. The download link has no `download` attribute
   so a refusal is never saved as a ".pdf".
4. **Trade-off:** guests are identified by cookie, not IP — Zimbabwean mobile networks (CGNAT)
   and school Wi-Fi put many people behind one IP. Clearing cookies resets the allowance; it is
   a nudge to sign up, not DRM. Scraping stays bounded by the per-IP file rate limiter.
   Rows older than 7 days are purged opportunistically.

### 5.3 Registration

`<form action={registerAction}>` (works pre-hydration) → zod (`registerSchema`: age ≤ 17 in
Africa/Harare time, guardian e-mail < 13, EC No. normalisation) → rate limit → insert (unique
constraints, not pre-checks, so concurrent sign-ups can't race) → session cookie → redirect to
a validated `next` path.

### 5.4 Support ticket

Validate → honeypot → per-IP hourly (memory) + daily (DB) limits → **insert ticket** → send
e-mail to `SUPPORT_INBOX` with `Reply-To` = sender → store `delivery_status`
(`sent | failed | not_configured`) → user sees reference `ZCH-XXXXXX` and an honest delivery
message. Admins can retry failed deliveries.

### 5.5 Errors

Server: `instrumentation.onRequestError` + explicit `captureServerError()` → JSON log line +
`error_logs` row (budgeted to 120/min so an outage can't DDoS the DB). Client: `window.onerror`,
`unhandledrejection`, React error boundaries → localStorage buffer (survives offline) →
`navigator.sendBeacon('/api/telemetry')` → same table. Admin groups by fingerprint.

## 6. Security

- **Sessions:** 256-bit random tokens; only SHA-256 stored; `HttpOnly`, `SameSite=Lax`,
  `Secure` in production; 30-day sliding expiry; "sign out everywhere"; suspension revokes all.
- **Passwords:** scrypt (N=2¹⁴, r=8, p=1), parameters encoded in the hash; constant-time compare;
  dummy hash for unknown e-mails (no user enumeration via timing); generic error message.
- **Authorisation:** single pure `resolveAccess()` used by pages *and* the file route. Every admin
  page **and** every admin Server Action calls `requireAdmin()` (actions are public endpoints).
  Non-admins get 404 for `/admin`.
- **Input:** zod everywhere; Server Action args treated as untrusted; UUID validation on ids;
  storage keys regex-checked and path-traversal-guarded; PDF magic-byte + parse validation;
  cover images type/size limited.
- **Abuse:** rate limits on sign-in (IP + e-mail), registration, support, telemetry, file bytes;
  honeypot; `X-Forwarded-For` trusted only with `TRUST_PROXY=true`.
- **Headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS (prod), strict referrer policy.
- **Open redirects:** `safeNextPath()` (tested against `//evil`, `/\evil`, `javascript:`).
- **Shared devices:** sign-out clears cached pages in the service worker and removes
  educator-only offline documents.
- **Privacy:** IPs stored only as salted hashes; learners provide DOB + grade (no phone/address).

## 7. Edge cases handled

| Area | Edge case | Handling |
| --- | --- | --- |
| Age | 29 Feb birthdays; server in another timezone; learner turns 18 | Harare-date arithmetic, leap-day rule tested; aged-out learners keep access with a notice |
| Age | Impossible dates (`2011-02-30`), future DOB | Strict calendar parsing → field error |
| Counters | Refresh spam, pdf.js range requests, view+download same day | Counted once per user/resource/day; range requests past byte 0 ignored |
| Counters | CDN serving a slightly stale count after a bump | Client store is monotonic (never decreases) |
| Viewer | Old Android browsers | pdf.js *legacy* build, `isEvalSupported:false` |
| Viewer | Huge textbooks on 2G | `disableAutoFetch` + range requests: only visible pages download; IntersectionObserver rendering; DPR capped |
| Viewer | Encrypted / unsplittable PDF | Upload succeeds, no guest preview; UI explains; admin list flags "No guest preview" |
| Viewer | Offline with saved copy / without | Opens from Cache API / clear "not saved on this device" message |
| Uploads | Duplicate file, fake PDF, truncated PDF, >25 MB, bad cover type | SHA-256 uniqueness, magic bytes, parse-and-walk, size caps — each with a specific message |
| Uploads | Title collision | Slug suffix retry |
| Search | Operators/punctuation (`&`, `!`, `:*`), accents, very long input | Tokenised to safe prefix tsquery; accents folded; 8 terms × 32 chars; punctuation-only returns 0 results |
| Catalogue | `?page=999`, invalid tier/year/type, level from another tier | Schema `.catch()` defaults; page clamped to last page |
| Auth | Concurrent duplicate registration; duplicate EC number | Unique constraints mapped to field errors |
| Auth | Submitting before JS loads | Server Actions + `useActionState` work as plain form posts; values echoed back |
| Forms | `<select>` losing its value after a failed submit | Select remounts on the echoed value (regression-tested) |
| Support | Mail provider down / not configured | Ticket stored first; status shown honestly; admin retry |
| Storage | Device storage nearly full | `navigator.storage.estimate()` check before saving offline; `persist()` requested |
| Storage | Private mode / blocked localStorage | All storage access wrapped; features degrade silently |
| Infra | DB unreachable at boot | Startup logs error; handle retried on next request; `/api/health` returns 503 |
| Infra | Multiple instances migrating at once | `pg_advisory_lock` around migrations |

## 8. Error-handling strategy

- **Expected failures** (validation, duplicates, rate limits, access denied) are values, not
  exceptions: actions return `FormState`, route handlers return typed JSON errors
  (`{ error, message }`) with correct status codes (400/401/403/404/413/416/429).
- **Unexpected failures** are caught at the boundary, logged with context, persisted, and the
  user gets a calm, actionable message (plus an error digest on error pages). No stack traces leak.
- **Side effects that must not fail the request** (session renewal, counter bump during a
  download, session purge) are best-effort with logging.
- **Global nets:** `app/error.tsx`, `app/global-error.tsx`, `onRequestError`, client handlers.

## 9. Performance

- **First load:** ~103 kB shared JS (React + Next), 110–115 kB on content pages; admin-only code
  (upload form) is split out of public bundles. No web fonts, no images required.
- **SSR everywhere** so content is visible before JS executes; Data-Saver resolved server-side
  (cookie or `Save-Data` header) so no thumbnails are ever *sent*, not merely hidden.
- **Database:** partial indexes for browse/popular/newest, GIN full-text index, card-sized
  projections (no `SELECT *` in listings), bounded time windows for metrics, per-request
  memoisation of the session lookup (`React.cache`).
- **Bytes over the wire:** ETag/304 on documents; guest previews publicly cacheable;
  immutable cover URLs; counts API cacheable at the edge; one polling request per tab.
- **Service worker:** hashed assets cache-first; pages network-first with a 6 s timeout falling
  back to cache (2G reality); bounded caches (40 pages / 150 assets).
- **Observed locally** (production build, PGlite): pages render in 25–160 ms server time.

## 10. Configuration

See `.env.example`. Nothing is required in development. In production set at least
`DATABASE_URL`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`,
`MAIL_FROM` (a domain verified with Resend) and `TRUST_PROXY` if behind a proxy.
`SEED_DEMO_CONTENT` must stay off in production (demo counts are illustrative).

## 11. Known limitations & next steps

- **Rate limiter is in-memory** (per instance). For >1 instance, back `RateLimiter` with Redis.
- **Local-disk storage.** For multi-instance or serverless hosting, implement `FileStorage` for
  S3/R2 (interface already isolated) and serve documents via signed URLs.
- **Password reset** is support-assisted; a self-service e-mail reset flow is the next auth feature.
- **Resource editing** (metadata changes after upload) is not yet in the admin UI (publish/hide/delete are).
- **Next.js 16** is available; upgrading means renaming `middleware.ts` → `proxy.ts` and
  building with Turbopack (drop the `canvas` webpack alias, which Turbopack handles via
  `turbopack.resolveAlias`).
- Counter hot-row contention is fine at this scale; at very high volume, aggregate
  `resource_daily_uniques` periodically instead of incrementing inline.
