import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getEnv } from "./env";

/**
 * Best-effort client IP. X-Forwarded-For is only trusted when TRUST_PROXY is
 * set, otherwise any client could spoof it to dodge rate limits.
 */
export function clientIpFrom(h: Headers): string {
  if (getEnv().TRUST_PROXY) {
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = h.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "local";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/** One-way hash so we can rate-limit / spot abuse without storing raw IPs. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`zch:${ip}`).digest("hex").slice(0, 32);
}
