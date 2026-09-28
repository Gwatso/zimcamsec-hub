"use client";

/**
 * Client error reporting. Errors are buffered in localStorage (so ones that
 * happen offline aren't lost), de-duplicated per page load, capped, and sent
 * in batches with navigator.sendBeacon — which survives page unloads and never
 * blocks the UI.
 */
type Kind = "error" | "unhandledrejection" | "react";

interface TelemetryEvent {
  kind: Kind;
  message: string;
  stack?: string;
  url?: string;
  at: number;
}

const BUFFER_KEY = "zch-telemetry-buffer-v1";
const MAX_BUFFER = 20;
const MAX_PER_PAGE = 10;
const seen = new Set<string>();
let sentThisPage = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readBuffer(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: TelemetryEvent[]) {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
  } catch {
    /* storage full or blocked — drop silently */
  }
}

export function reportClientError(kind: Kind, error: unknown) {
  if (sentThisPage >= MAX_PER_PAGE) return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  const key = `${kind}|${err.message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sentThisPage += 1;

  writeBuffer([
    ...readBuffer(),
    {
      kind,
      message: err.message.slice(0, 1000) || "(no message)",
      stack: err.stack?.slice(0, 8000),
      url: location.href.slice(0, 1000),
      at: Date.now(),
    },
  ]);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushTelemetry();
  }, 2000);
}

export function flushTelemetry() {
  if (!navigator.onLine) return;
  const events = readBuffer();
  if (events.length === 0) return;
  const body = JSON.stringify({ events: events.slice(0, 20) });
  const sent =
    typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/telemetry", body);
  if (!sent) {
    fetch("/api/telemetry", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(
      () => undefined,
    );
  }
  writeBuffer(events.slice(20));
}
