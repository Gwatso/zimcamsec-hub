import { desc, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { TIERS } from "@/lib/curriculum";
import { getDb } from "@/server/db/client";
import { resources } from "@/server/db/schema";
import { getEnv } from "@/server/env";

// Generated on request (never at build time, which has no database).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getEnv().APP_URL;
  const db = await getDb();
  const rows = await db
    .select({ slug: resources.slug, updatedAt: resources.updatedAt })
    .from(resources)
    .where(eq(resources.isPublished, true))
    .orderBy(desc(resources.updatedAt))
    .limit(45_000); // sitemap protocol caps a file at 50k URLs

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/resources`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/curriculum`, changeFrequency: "monthly", priority: 0.8 },
    ...TIERS.map((t) => ({ url: `${base}/curriculum/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/support`, changeFrequency: "yearly", priority: 0.3 },
    ...rows.map((r) => ({ url: `${base}/resources/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
