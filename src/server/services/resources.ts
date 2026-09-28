import "server-only";
import { type SQL, and, asc, count, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Audience, TierSlug } from "@/lib/curriculum";
import { toPrefixTsQuery } from "@/lib/search";
import type { CatalogueQuery } from "@/lib/validation";
import { getDb } from "../db/client";
import { resourceEvents, resources } from "../db/schema";

export const PAGE_SIZE = 24;

/** Card-sized projection: never select file keys or large text for listings. */
const summaryColumns = {
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
};

export interface ResourceSummary {
  id: string;
  slug: string;
  title: string;
  tier: string;
  level: string | null;
  subject: string | null;
  resourceType: string;
  audience: Audience;
  year: number | null;
  examSession: "june" | "november" | null;
  paperNumber: number | null;
  fileSizeBytes: number;
  pageCount: number;
  downloadCount: number;
  hasCover: boolean;
  createdAt: Date;
}

export interface CatalogueResult {
  items: ResourceSummary[];
  total: number;
  page: number;
  pageCount: number;
}

const SEARCH = sql.raw(`"resources"."search"`);

export type CatalogueFilters = Partial<Pick<CatalogueQuery, "q" | "tier" | "level" | "subject" | "type" | "year">> &
  Pick<CatalogueQuery, "sort" | "page">;

export async function listResources(query: CatalogueFilters, pageSize = PAGE_SIZE): Promise<CatalogueResult> {
  const db = await getDb();
  const tsQuery = toPrefixTsQuery(query.q);
  const conditions: SQL[] = [eq(resources.isPublished, true)];
  if (query.tier) conditions.push(eq(resources.tier, query.tier));
  if (query.level) conditions.push(eq(resources.level, query.level));
  if (query.subject) conditions.push(eq(resources.subject, query.subject));
  if (query.type) conditions.push(eq(resources.resourceType, query.type));
  if (query.year) conditions.push(eq(resources.year, query.year));
  if (query.q && !tsQuery) {
    // Input had no searchable characters (e.g. only punctuation): no results rather than everything.
    return { items: [], total: 0, page: 1, pageCount: 0 };
  }
  if (tsQuery) conditions.push(sql`${SEARCH} @@ to_tsquery('simple', ${tsQuery})`);
  const where = and(...conditions);

  const orderBy: SQL[] = (() => {
    switch (query.sort) {
      case "relevance":
        return tsQuery
          ? [sql`ts_rank(${SEARCH}, to_tsquery('simple', ${tsQuery})) DESC`, desc(resources.downloadCount)]
          : [desc(resources.downloadCount)];
      case "newest":
        return [desc(resources.createdAt)];
      case "title":
        return [asc(resources.title)];
      default:
        return [desc(resources.downloadCount), desc(resources.createdAt)];
    }
  })();

  const [totalRow] = await db.select({ n: count() }).from(resources).where(where);
  const total = totalRow?.n ?? 0;
  const pageCount = Math.ceil(total / pageSize);
  // Clamp out-of-range pages (e.g. stale bookmarked ?page=40) to the last page.
  const page = Math.min(Math.max(1, query.page), Math.max(1, pageCount));

  const items =
    total === 0
      ? []
      : await db
          .select(summaryColumns)
          .from(resources)
          .where(where)
          .orderBy(...orderBy, asc(resources.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

  return { items: items as ResourceSummary[], total, page, pageCount };
}

export async function getResourceBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.slug, slug), eq(resources.isPublished, true)))
    .limit(1);
  return row ?? null;
}

/** Includes unpublished rows — callers decide (admins may preview drafts). */
export async function getResourceById(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
  return row ?? null;
}

export async function getRelatedResources(resource: { id: string; tier: string; subject: string | null }, limit = 4) {
  const db = await getDb();
  const conditions = [eq(resources.isPublished, true), eq(resources.tier, resource.tier), sql`${resources.id} <> ${resource.id}`];
  if (resource.subject) conditions.push(eq(resources.subject, resource.subject));
  const rows = await db
    .select(summaryColumns)
    .from(resources)
    .where(and(...conditions))
    .orderBy(desc(resources.downloadCount))
    .limit(limit);
  return rows as ResourceSummary[];
}

export async function getLatestResources(limit = 8) {
  const db = await getDb();
  const rows = await db
    .select(summaryColumns)
    .from(resources)
    .where(eq(resources.isPublished, true))
    .orderBy(desc(resources.createdAt))
    .limit(limit);
  return rows as ResourceSummary[];
}

/** Trending = most unique accesses in the last 7 days, topped up with all-time popular. */
export async function getTrendingResources(limit = 8): Promise<ResourceSummary[]> {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = db
    .select({ resourceId: resourceEvents.resourceId, hits: count().as("hits") })
    .from(resourceEvents)
    .where(gte(resourceEvents.createdAt, since))
    .groupBy(resourceEvents.resourceId)
    .as("recent");

  const rows = (await db
    .select(summaryColumns)
    .from(resources)
    .leftJoin(recent, eq(recent.resourceId, resources.id))
    .where(eq(resources.isPublished, true))
    .orderBy(sql`coalesce(${recent.hits}, 0) DESC`, desc(resources.downloadCount))
    .limit(limit)) as ResourceSummary[];
  return rows;
}

export async function getTierCounts(): Promise<Record<TierSlug, number>> {
  const db = await getDb();
  const rows = await db
    .select({ tier: resources.tier, n: count() })
    .from(resources)
    .where(eq(resources.isPublished, true))
    .groupBy(resources.tier);
  const out = { infant: 0, junior: 0, "lower-secondary": 0, "upper-secondary": 0, policy: 0 } as Record<TierSlug, number>;
  for (const r of rows) if (r.tier in out) out[r.tier as TierSlug] = r.n;
  return out;
}

export async function getSubjectCounts(tier: TierSlug): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ subject: resources.subject, n: count() })
    .from(resources)
    .where(and(eq(resources.isPublished, true), eq(resources.tier, tier), isNotNull(resources.subject)))
    .groupBy(resources.subject);
  return Object.fromEntries(rows.map((r) => [r.subject ?? "", r.n]));
}

export async function getAvailableYears(tier?: TierSlug): Promise<number[]> {
  const db = await getDb();
  const conditions = [eq(resources.isPublished, true), isNotNull(resources.year)];
  if (tier) conditions.push(eq(resources.tier, tier));
  const rows = await db
    .selectDistinct({ year: resources.year })
    .from(resources)
    .where(and(...conditions))
    .orderBy(desc(resources.year));
  return rows.map((r) => r.year).filter((y): y is number => y !== null);
}

export async function getPlatformStats() {
  const db = await getDb();
  const [row] = await db
    .select({ resources: count(), downloads: sql<number>`coalesce(sum(${resources.downloadCount}), 0)::int` })
    .from(resources)
    .where(eq(resources.isPublished, true));
  return { resources: row?.resources ?? 0, downloads: Number(row?.downloads ?? 0) };
}

/** Public counter lookup for the live badges (max 50 ids per call). */
export async function getDownloadCounts(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select({ id: resources.id, n: resources.downloadCount })
    .from(resources)
    .where(and(inArray(resources.id, ids.slice(0, 50)), eq(resources.isPublished, true)));
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}
