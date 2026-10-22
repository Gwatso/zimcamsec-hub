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
| `npm run scans -- <in> <out>` | Clean, compress, OCR and stamp scanned papers before uploading (below) |

## Preparing scanned papers

Papers collected from WhatsApp are usually phone photos or heavy scans. `npm run scans` turns a
folder of them into small, searchable PDFs ready to upload:

```bash
npm run scans -- ~/whatsapp-papers ~/ready-to-upload --site zimcamsec.co.zw
```

- **Input:** each loose PDF/JPG/PNG is one paper; each sub-folder is one paper whose files are
  merged in name order (e.g. the WhatsApp photos `IMG-…-WA0001.jpg`, `WA0002.jpg`, …).
- **Per paper:** photos are turned upright (EXIF), converted to greyscale and downsampled
  (`--dpi 200`, `--color` to keep colour maps), straightened and OCR'd so the text is searchable,
  then a footer strip with your site address is added *below* each page (nothing on the paper is
  covered). A 7 MB set of photos typically becomes ~0.5 MB.
- **Output:** `<suggested-title>.pdf`, `<…>.txt` (the text) and `manifest.json` with suggested
  level, subject, paper number, session, year and title read from the cover, plus warnings —
  blurred scans, files over the 25 MB upload limit, and likely duplicates (the same paper
  scanned by someone else). Always check the suggestions before publishing.
- **Needs** [OCRmyPDF](https://ocrmypdf.readthedocs.io) and Ghostscript. Linux, or Windows via
  WSL (Ubuntu): `sudo apt install ocrmypdf tesseract-ocr ghostscript unpaper`. Add Shona/Ndebele
  OCR with `--lang eng+sna` after installing the matching Tesseract language pack, if available.

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
