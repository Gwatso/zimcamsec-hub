/* Zimcamsec Hub service worker — hand-written, no build step.
 *
 * Strategy
 *  - App shell (/offline, icon, pdf.js worker) is pre-cached at install.
 *  - Hashed build assets (/_next/static/*) are immutable → cache-first.
 *  - Public HTML pages → network-first with a timeout (slow 2G/3G), falling
 *    back to the last cached copy, then to /offline.
 *  - Private pages (/account, /admin, /auth) and all /api/ requests are never
 *    cached here. Saved PDFs live in the "zch-docs-v1" cache, which the page
 *    manages explicitly and which survives service-worker upgrades.
 */
const VERSION = "v1";
const SHELL_CACHE = `zch-shell-${VERSION}`;
const PAGES_CACHE = `zch-pages-${VERSION}`;
const STATIC_CACHE = `zch-static-${VERSION}`;
const DOCS_CACHE = "zch-docs-v1";
const KEEP = new Set([SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, DOCS_CACHE]);

const PRECACHE = ["/offline", "/icon.svg", "/manifest.webmanifest", "/pdf.worker.min.mjs"];
const MAX_PAGES = 40;
const MAX_STATIC = 150;
const NETWORK_TIMEOUT_MS = 6000;
const PRIVATE_PREFIXES = ["/account", "/admin", "/auth/", "/api/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("zch-") && !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PAGE_CACHE") {
    // Sign-out on a shared device: drop pages that may show the previous user's name.
    event.waitUntil(
      Promise.all([
        caches.delete(PAGES_CACHE),
        caches.open(SHELL_CACHE).then((cache) => cache.delete("/offline")),
      ]),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC));
    return;
  }
  if (PRECACHE.includes(url.pathname) && url.pathname !== "/offline") {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
  // Everything else (RSC payloads, etc.) goes straight to the network. When
  // offline, Next.js falls back to a full navigation, which is handled above.
});

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone()).then(() => maxEntries && trim(cache, maxEntries));
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone()).then(() => trim(cache, MAX_PAGES));
      if (new URL(request.url).pathname === "/offline") {
        caches.open(SHELL_CACHE).then((shell) => shell.put("/offline", response.clone()));
      }
    }
    return response;
  } catch {
    const cached = (await cache.match(request, { ignoreVary: true })) || (await caches.match("/offline", { ignoreVary: true }));
    return (
      cached ||
      new Response("<h1>You're offline</h1><p>Reconnect to continue.</p>", {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

/** Resolves with the network response, or — after `ms` — with a cached copy if one exists. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) resolve(cached);
    }, ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}
