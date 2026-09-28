import "server-only";
import { count, desc, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { errorLogs, resourceEvents, resources } from "../db/schema";

export interface DailyPoint {
  day: string;
  views: number;
  downloads: number;
}

/** Views/downloads per Harare day for the last `days` days, zero-filled. */
export async function getDailyActivity(days = 14): Promise<DailyPoint[]> {
  const db = await getDb();
  const result = await db.execute<{ day: string; views: number; downloads: number }>(sql`
    WITH span AS (
      SELECT generate_series(
        (now() AT TIME ZONE 'Africa/Harare')::date - ${days - 1}::int,
        (now() AT TIME ZONE 'Africa/Harare')::date,
        interval '1 day'
      )::date AS day
    )
    SELECT to_char(span.day, 'YYYY-MM-DD') AS day,
           count(e.id) FILTER (WHERE e.kind = 'view')::int AS views,
           count(e.id) FILTER (WHERE e.kind = 'download')::int AS downloads
    FROM span
    LEFT JOIN (
      -- Bounded by the created_at index before any per-row date conversion.
      SELECT id, kind, created_at FROM ${resourceEvents}
      WHERE created_at >= now() - make_interval(days => ${days + 1}::int)
    ) e ON (e.created_at AT TIME ZONE 'Africa/Harare')::date = span.day
    GROUP BY span.day
    ORDER BY span.day
  `);
  return result.rows.map((r) => ({ day: String(r.day), views: Number(r.views), downloads: Number(r.downloads) }));
}

export async function getTopResources(limit = 10) {
  const db = await getDb();
  return db
    .select({ id: resources.id, slug: resources.slug, title: resources.title, downloadCount: resources.downloadCount })
    .from(resources)
    .orderBy(desc(resources.downloadCount))
    .limit(limit);
}

export async function getOverview() {
  const db = await getDb();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [[res], [events24h], [errors24h]] = await Promise.all([
    db
      .select({
        total: count(),
        published: sql<number>`count(*) FILTER (WHERE ${resources.isPublished})::int`,
        downloads: sql<number>`coalesce(sum(${resources.downloadCount}), 0)::int`,
        bytes: sql<number>`coalesce(sum(${resources.fileSizeBytes}), 0)::bigint`,
      })
      .from(resources),
    db.select({ n: count() }).from(resourceEvents).where(gte(resourceEvents.createdAt, dayAgo)),
    db.select({ n: count() }).from(errorLogs).where(gte(errorLogs.createdAt, dayAgo)),
  ]);
  return {
    resources: res?.total ?? 0,
    published: Number(res?.published ?? 0),
    downloads: Number(res?.downloads ?? 0),
    storageBytes: Number(res?.bytes ?? 0),
    events24h: events24h?.n ?? 0,
    errors24h: errors24h?.n ?? 0,
  };
}
