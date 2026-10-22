import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { guestDownloadDecision, type GuestDownloadDecision } from "@/lib/access";
import { harareDate } from "@/lib/dates";
import { getDb } from "../db/client";
import { guestDownloads, resourceEvents, resources } from "../db/schema";
import { log } from "../logger";

/**
 * Daily download allowance for visitors without an account.
 *
 * Guests are told apart by a random cookie, not by IP address: Zimbabwean
 * mobile networks and school Wi-Fi put hundreds of people behind one IP, so an
 * IP limit would lock out innocent visitors. Clearing cookies resets the
 * allowance — that's accepted; the goal is a nudge to sign up, not DRM. Bulk
 * scraping is still bounded by the per-IP file rate limiter.
 */

const GUEST_ID = /^[A-Za-z0-9_-]{22}$/;
/** Rows older than this are deleted opportunistically; only today's rows matter. */
const RETENTION_DAYS = 7;

export function newGuestId(): string {
  return randomBytes(16).toString("base64url");
}

export function parseGuestId(value: string | undefined | null): string | null {
  return value && GUEST_ID.test(value) ? value : null;
}

/** Resource ids this guest has downloaded today (Harare time). */
export async function getGuestDownloadsToday(guestId: string, day: string = harareDate()): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ resourceId: guestDownloads.resourceId })
    .from(guestDownloads)
    .where(and(eq(guestDownloads.guestId, guestId), eq(guestDownloads.day, day)));
  return rows.map((r) => r.resourceId);
}

/**
 * Checks the allowance and, when this is a new file for today, records it,
 * logs the event and bumps the public counter — all in one transaction. A
 * per-guest advisory lock stops two parallel downloads of different files
 * from both slipping under the limit.
 */
export async function claimGuestDownload(input: {
  guestId: string;
  resourceId: string;
  day?: string;
}): Promise<GuestDownloadDecision> {
  const day = input.day ?? harareDate();
  const db = await getDb();
  const decision = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.guestId}))`);
    const rows = await tx
      .select({ resourceId: guestDownloads.resourceId })
      .from(guestDownloads)
      .where(and(eq(guestDownloads.guestId, input.guestId), eq(guestDownloads.day, day)));
    const result = guestDownloadDecision(
      rows.map((r) => r.resourceId),
      input.resourceId,
    );
    if (!result.isNew) return result;

    await tx.insert(guestDownloads).values({ guestId: input.guestId, day, resourceId: input.resourceId });
    await tx.insert(resourceEvents).values({ resourceId: input.resourceId, userId: null, kind: "download" });
    await tx
      .update(resources)
      .set({ downloadCount: sql`${resources.downloadCount} + 1` })
      .where(eq(resources.id, input.resourceId));
    return result;
  });

  // Opportunistic housekeeping (~1% of new guest downloads) instead of a cron job.
  if (decision.isNew && Math.random() < 0.01) {
    const cutoff = harareDate(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
    db.delete(guestDownloads)
      .where(lt(guestDownloads.day, cutoff))
      .catch((error: unknown) => log("warning", "guest download purge failed", { error: String(error) }));
  }
  return decision;
}
