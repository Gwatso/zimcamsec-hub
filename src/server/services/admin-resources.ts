import "server-only";
import { randomBytes } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import { GUEST_PREVIEW_PAGES } from "@/lib/access";
import { slugify } from "@/lib/format";
import type { ResourceMetadata } from "@/lib/validation";
import { getDb } from "../db/client";
import { resources } from "../db/schema";
import { log } from "../logger";
import { analysePdf } from "../pdf";
import { getStorage } from "../storage";

export class DuplicateResourceError extends Error {
  constructor(public readonly existing: { slug: string; title: string }) {
    super(`This exact file is already published as “${existing.title}”.`);
    this.name = "DuplicateResourceError";
  }
}

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function coverExtension(mime: string): string | null {
  return COVER_TYPES[mime] ?? null;
}

/**
 * Ingest pipeline: validate → hash (dedupe) → count pages → build guest
 * preview → store blobs → insert row. Blobs are content-addressed by SHA-256,
 * so a failed insert can't leave a DB row pointing at a missing file, and a
 * retried upload overwrites the same keys.
 */
export async function createResource(input: {
  metadata: ResourceMetadata;
  pdf: Uint8Array;
  cover?: { data: Uint8Array; mime: string } | null;
  createdBy: string;
}) {
  const db = await getDb();
  const storage = getStorage();
  const analysed = await analysePdf(input.pdf, GUEST_PREVIEW_PAGES);

  const [duplicate] = await db
    .select({ slug: resources.slug, title: resources.title })
    .from(resources)
    .where(eq(resources.checksumSha256, analysed.checksum))
    .limit(1);
  if (duplicate) throw new DuplicateResourceError(duplicate);

  const fileKey = `resources/${analysed.checksum}.pdf`;
  const previewKey = analysed.preview ? `previews/${analysed.checksum}-p${GUEST_PREVIEW_PAGES}.pdf` : null;
  await storage.put(fileKey, input.pdf);
  if (previewKey && analysed.preview) await storage.put(previewKey, analysed.preview);

  let coverKey: string | null = null;
  if (input.cover) {
    const ext = coverExtension(input.cover.mime);
    if (ext) {
      coverKey = `covers/${analysed.checksum}.${ext}`;
      await storage.put(coverKey, input.cover.data);
    }
  }

  const m = input.metadata;
  const baseSlug = slugify(m.title) || "resource";
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomBytes(3).toString("hex")}`;
    const [row] = await db
      .insert(resources)
      .values({
        slug,
        title: m.title,
        description: m.description,
        tier: m.tier,
        level: m.level ?? null,
        subject: m.subject ?? null,
        resourceType: m.resourceType,
        audience: m.audience,
        year: m.year ?? null,
        examSession: m.examSession ?? null,
        paperNumber: m.paperNumber ?? null,
        fileKey,
        previewKey,
        coverKey,
        fileSizeBytes: input.pdf.byteLength,
        pageCount: analysed.pageCount,
        checksumSha256: analysed.checksum,
        isPublished: m.isPublished,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: resources.slug })
      .returning({ id: resources.id, slug: resources.slug });
    if (row) {
      log("info", "resource created", { id: row.id, slug: row.slug, pages: analysed.pageCount, preview: !!previewKey });
      return row;
    }
  }
  throw new Error("Could not allocate a unique slug");
}

export async function setResourcePublished(id: string, isPublished: boolean) {
  const db = await getDb();
  await db.update(resources).set({ isPublished, updatedAt: new Date() }).where(eq(resources.id, id));
}

/** Deletes the row, then its blobs (a leftover blob is harmless; a dangling row is not). */
export async function deleteResource(id: string) {
  const db = await getDb();
  const [row] = await db.delete(resources).where(eq(resources.id, id)).returning();
  if (!row) return;
  const storage = getStorage();
  await Promise.allSettled(
    [row.fileKey, row.previewKey, row.coverKey].filter((k): k is string => !!k).map((k) => storage.delete(k)),
  );
}

export const ADMIN_RESOURCES_PAGE_SIZE = 30;

export async function listAllResources(page: number) {
  const db = await getDb();
  const [total] = await db.select({ n: count() }).from(resources);
  const rows = await db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      tier: resources.tier,
      resourceType: resources.resourceType,
      audience: resources.audience,
      isPublished: resources.isPublished,
      downloadCount: resources.downloadCount,
      fileSizeBytes: resources.fileSizeBytes,
      pageCount: resources.pageCount,
      previewKey: resources.previewKey,
      createdAt: resources.createdAt,
    })
    .from(resources)
    .orderBy(desc(resources.createdAt))
    .limit(ADMIN_RESOURCES_PAGE_SIZE)
    .offset((Math.max(1, page) - 1) * ADMIN_RESOURCES_PAGE_SIZE);
  return { rows, total: total?.n ?? 0 };
}
