import type { NextRequest } from "next/server";
import { telemetrySchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { jsonError } from "@/server/http";
import { persistError } from "@/server/logger";
import { limits } from "@/server/rate-limit";
import { clientIpFrom } from "@/server/request";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Receives batches of browser errors captured by the global handlers
 * (window.onerror / unhandledrejection / React error boundaries). Sent via
 * navigator.sendBeacon, so it must accept text/plain bodies.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return jsonError(413, "too_large", "Payload too large.");

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return jsonError(403, "forbidden", "Cross-origin telemetry rejected.");

  if (!limits.telemetry().check(clientIpFrom(request.headers)).ok) {
    return new Response(null, { status: 204 }); // Silently drop — never make the client retry.
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return jsonError(413, "too_large", "Payload too large.");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON.");
  }
  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request", "Invalid telemetry payload.");

  const user = await getCurrentUser().catch(() => null);
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  for (const event of parsed.data.events) {
    await persistError({
      source: "client",
      message: `${event.kind}: ${event.message}`,
      stack: event.stack ?? null,
      url: event.url ?? null,
      context: { userAgent, capturedAt: event.at ?? null },
      userId: user?.id ?? null,
    });
  }
  return new Response(null, { status: 204 });
}
