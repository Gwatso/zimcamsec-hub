import "server-only";
import { desc, eq, max, sql } from "drizzle-orm";
import { harareDate } from "@/lib/dates";
import { getDb } from "../db/client";
import { resourceDailyUniques, resourceEvents, resources } from "../db/schema";
import type { ResourceSummary } from "./resources";

/**
 * Records a view/download and bumps the public counter at most once per user,
 * per resource, per (Harare) day. Every event is still logged for history and
 * metrics; only the social-proof counter is de-duplicated so refresh-spamming
 * or pdf.js range requests can't inflate it.
 */
export async function recordResourceAccess(input: {
  resourceId: string;
  userId: string;
  kind: "view" | "download";
}): Promise<{ counted: boolean; downloadCount: number | null }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.insert(resourceEvents).values(input);
    const inserted = await tx
      .insert(resourceDailyUniques)
      .values({ resourceId: input.resourceId, userId: input.userId, day: harareDate() })
      .onConflictDoNothing()
      .returning({ resourceId: resourceDailyUniques.resourceId });

    if (inserted.length === 0) return { counted: false, downloadCount: null };

    const [updated] = await tx
      .update(resources)
      .set({ downloadCount: sql`${resources.downloadCount} + 1` })
      .where(eq(resources.id, input.resourceId))
      .returning({ downloadCount: resources.downloadCount });
    return { counted: true, downloadCount: updated?.downloadCount ?? null };
  });
}

export interface HistoryItem extends ResourceSummary {
  lastAccessedAt: Date;
}

/** A user's recently accessed resources (one row per resource, newest first). */
export async function getUserHistory(userId: string, limit = 30): Promise<HistoryItem[]> {
  const db = await getDb();
  const lastAccessed = max(resourceEvents.createdAt);
  const rows = await db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      tier: resources.tier,
      level: resources.level,
      subject: resources.subject,
      resourceType: resources.resourceType,
      audience: resources.audience,
      year: resources.year,
      examSession: resources.examSession,
      paperNumber: resources.paperNumber,
      fileSizeBytes: resources.fileSizeBytes,
      pageCount: resources.pageCount,
      downloadCount: resources.downloadCount,
      hasCover: sql<boolean>`${resources.coverKey} IS NOT NULL`,
      createdAt: resources.createdAt,
      lastAccessedAt: lastAccessed,
    })
    .from(resourceEvents)
    .innerJoin(resources, eq(resources.id, resourceEvents.resourceId))
    .where(eq(resourceEvents.userId, userId))
    .groupBy(resources.id)
    .orderBy(desc(lastAccessed))
    .limit(limit);

  return rows.map((r) => ({ ...r, lastAccessedAt: new Date(r.lastAccessedAt ?? r.createdAt) })) as HistoryItem[];
}
