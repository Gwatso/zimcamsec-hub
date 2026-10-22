# Zimcamsec Hub

**The Elite Educational & Heritage-Based Curriculum Portal** — free past papers, specimen papers,
study notes, schemes of work and Ministry circulars for Zimbabwe's Heritage-Based Curriculum,
ECD A to Form 6. Built for mobile data, rural connections and shared devices.

- 📊 Live download counters (spam-resistant, updated in real time)
- 🔒 Learner accounts (17 and under) and verified-teacher accounts (EC Number + school)
- 📄 In-app PDF viewer — guests preview 2 pages (enforced on the server)
- ⬇️ No sign-up needed to download: guests get 1 free PDF a day, accounts are unlimited
- ⚡ Data-Saver mode (also honours the browser's `Save-Data` hint) and offline saving
- 🎧 Help & Support desk routed to **edu.novacacia@gmail.com**
- 🛠️ Master Admin: metrics, content upload, teacher verification, support queue, system error logs

Architecture, data flows, edge cases and trade-offs: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Quick start

Requires Node.js 20.9+. No database installation is needed for development — an embedded
Postgres (PGlite) is created in `./.data/`, migrated and seeded with demo content automatically.

```bash
npm install
npm run dev          # http://localhost:3000
```

Development admin: `admin@zimcamsec.local` / `zimcamsec-admin-2026` (created only outside production).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit + integration tests (in-memory Postgres) |
| `npm run typecheck` | TypeScript strict check |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (also runs automatically on boot) |
| `npm run db:seed` | Create the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (+ demo data if `SEED_DEMO_CONTENT=true`) |

## Production

```bash
cp .env.example .env.production   # set DATABASE_URL, APP_URL, ADMIN_*, RESEND_API_KEY, MAIL_FROM
npm ci && npm run build
node .next/standalone/server.js   # copy .next/static and public/ next to it (standard Next standalone)
```

- Health check: `GET /api/health` (200 / 503).
- Uploaded files live in `STORAGE_DIR` — put it on a persistent volume and back it up with the database.
- Behind a reverse proxy, set `TRUST_PROXY=true` so rate limits see real client IPs.

## Disclaimer

Zimcamsec Hub is an independent, unofficial platform that indexes and compiles publicly
circulated educational documents. It is not affiliated with, endorsed by, or connected to any
National Examination Boards, Ministries of Education (including MoPSE), Cambridge International
Education, textbook publishers, or specific schools.

© 2026 Zimcamsec Hub. Support: edu.novacacia@gmail.com
