import "server-only";
import { and, count, desc, eq, lt, max, min, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { errorLogs } from "../db/schema";

/** Errors grouped by fingerprint ("issues"), most recent first. */
export async function listErrorGroups(source: "server" | "client" | "all", limit = 50) {
  const db = await getDb();
  const lastSeen = max(errorLogs.createdAt);
  return db
    .select({
      fingerprint: errorLogs.fingerprint,
      source: errorLogs.source,
      message: sql<string>`(array_agg(${errorLogs.message} ORDER BY ${errorLogs.createdAt} DESC))[1]`,
      stack: sql<string | null>`(array_agg(${errorLogs.stack} ORDER BY ${errorLogs.createdAt} DESC))[1]`,
      url: sql<string | null>`(array_agg(${errorLogs.url} ORDER BY ${errorLogs.createdAt} DESC))[1]`,
      occurrences: count(),
      firstSeen: min(errorLogs.createdAt),
      lastSeen,
    })
    .from(errorLogs)
    .where(source === "all" ? undefined : eq(errorLogs.source, source))
    .groupBy(errorLogs.fingerprint, errorLogs.source)
    .orderBy(desc(lastSeen))
    .limit(limit);
}

export async function purgeErrorLogs(options: { olderThanDays?: number; fingerprint?: string }) {
  const db = await getDb();
  const conditions = [];
  if (options.olderThanDays !== undefined) {
    conditions.push(lt(errorLogs.createdAt, new Date(Date.now() - options.olderThanDays * 86_400_000)));
  }
  if (options.fingerprint) conditions.push(eq(errorLogs.fingerprint, options.fingerprint));
  if (conditions.length === 0) return 0;
  const deleted = await db.delete(errorLogs).where(and(...conditions)).returning({ id: errorLogs.id });
  return deleted.length;
}
