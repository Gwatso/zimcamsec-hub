/**
 * Structured logging + error capture.
 *
 * Every error goes to stdout as one JSON line (for the hosting platform's log
 * drain) AND is persisted to `error_logs`, which powers the Master Admin
 * "System health" page. Persistence is best-effort, bounded and can never
 * throw back into the request that is already failing.
 */
import { createHash } from "node:crypto";
import { createRateLimiter } from "./rate-limit";

type Level = "info" | "warning" | "error";

export function log(level: Level, message: string, context: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...context });
  if (level === "error") console.error(line);
  else if (level === "warning") console.warn(line);
  else console.info(line);
}

export function fingerprint(source: string, message: string, stack?: string | null): string {
  // First stack frame + message identifies "the same bug" across occurrences.
  const frame = stack?.split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
  const normalised = message.replace(/\d+/g, "#").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>");
  return createHash("sha1").update(`${source}|${normalised}|${frame.trim()}`).digest("hex").slice(0, 16);
}

// Protects the database from an error storm (e.g. DB down → every request errors).
const persistBudget = createRateLimiter({ limit: 120, windowMs: 60_000 });

export interface CapturedError {
  source: "server" | "client";
  level?: "error" | "warning";
  message: string;
  stack?: string | null;
  url?: string | null;
  context?: Record<string, unknown>;
  userId?: string | null;
}

export async function persistError(entry: CapturedError): Promise<void> {
  if (!persistBudget.check("global").ok) return;
  try {
    const [{ getDb }, { errorLogs }] = await Promise.all([import("./db/client"), import("./db/schema")]);
    const db = await getDb();
    await db.insert(errorLogs).values({
      source: entry.source,
      level: entry.level ?? "error",
      message: entry.message.slice(0, 1000),
      stack: entry.stack?.slice(0, 8000) ?? null,
      url: entry.url?.slice(0, 1000) ?? null,
      fingerprint: fingerprint(entry.source, entry.message, entry.stack),
      context: entry.context ?? {},
      userId: entry.userId ?? null,
    });
  } catch (error) {
    // Never recurse into persistError here.
    log("error", "failed to persist error log", { cause: String(error) });
  }
}

export async function captureServerError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  // Next.js control-flow "errors" (redirect / notFound) are not failures.
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))) {
    return;
  }
  log("error", err.message, { name: err.name, stack: err.stack, ...context });
  await persistError({ source: "server", message: `${err.name}: ${err.message}`, stack: err.stack, context });
}
