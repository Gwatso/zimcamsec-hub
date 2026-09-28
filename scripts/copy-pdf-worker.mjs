// Copies the pdf.js worker into /public so it is served from our own origin
// (CSP-friendly, cacheable by the service worker, no bundler magic).
// We use the *legacy* build because many learners use older Android browsers.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

let pkgDir;
try {
  pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
} catch {
  console.warn("[copy-pdf-worker] pdfjs-dist is not installed yet; skipping.");
  process.exit(0);
}

const candidates = ["legacy/build/pdf.worker.min.mjs", "legacy/build/pdf.worker.mjs"];
const source = candidates.map((c) => join(pkgDir, c)).find((p) => existsSync(p));

if (!source) {
  console.error("[copy-pdf-worker] Could not find a pdf.js legacy worker in pdfjs-dist.");
  process.exit(1);
}

const target = join(process.cwd(), "public", "pdf.worker.min.mjs");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`[copy-pdf-worker] ${source} -> public/pdf.worker.min.mjs`);
