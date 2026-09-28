"use client";

/**
 * Shared store behind every <DownloadCounter>. Instead of each badge polling
 * on its own, visible counters register their ids and ONE batched request
 * refreshes them all. Polling pauses when the tab is hidden, the device is
 * offline, or Data-Saver is on. Counts only ever go up on the client (avoids
 * flicker from slightly stale CDN responses).
 */
const POLL_INTERVAL_MS = 45_000;
const BATCH = 50;

const counts = new Map<string, number>();
const refCounts = new Map<string, number>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let pollingEnabled = true;

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCount(id: string): number | undefined {
  return counts.get(id);
}

export function seedCount(id: string, value: number) {
  const current = counts.get(id);
  if (current === undefined || value > current) counts.set(id, value);
}

function apply(next: Record<string, number>) {
  let changed = false;
  for (const [id, value] of Object.entries(next)) {
    const current = counts.get(id);
    if (current === undefined || value > current) {
      counts.set(id, value);
      changed = true;
    }
  }
  if (changed) emit();
}

async function fetchCounts(ids: string[], fresh = false) {
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const url = `/api/resources/counts?ids=${chunk.join(",")}${fresh ? "&fresh=1" : ""}`;
    const res = await fetch(url, { cache: fresh ? "no-store" : "default" });
    if (!res.ok) return;
    const body = (await res.json()) as { counts: Record<string, number> };
    apply(body.counts);
  }
}

function canPoll() {
  return (
    pollingEnabled &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    navigator.onLine !== false
  );
}

function tick() {
  if (!canPoll() || refCounts.size === 0) return;
  fetchCounts([...refCounts.keys()]).catch(() => undefined);
}

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

export function register(id: string): () => void {
  refCounts.set(id, (refCounts.get(id) ?? 0) + 1);
  ensureTimer();
  return () => {
    const n = (refCounts.get(id) ?? 1) - 1;
    if (n <= 0) refCounts.delete(id);
    else refCounts.set(id, n);
  };
}

export function setPollingEnabled(enabled: boolean) {
  pollingEnabled = enabled;
}

/** Called right after the user's own download/view so they see their tick land. */
export function refreshSoon(id: string, delayMs = 1500) {
  setTimeout(() => {
    fetchCounts([id], true).catch(() => undefined);
  }, delayMs);
}
