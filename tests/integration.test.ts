/**
 * Integration tests against a real (in-memory) Postgres via PGlite: the same
 * migrations, SQL and constraints production runs on.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory://";
process.env.DATABASE_URL = "";
process.env.SEED_DEMO_CONTENT = "false";
process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), "zch-test-"));
process.env.RESEND_API_KEY = "";

const { getDb } = await import("@/server/db/client");
const { resources, users } = await import("@/server/db/schema");
const { recordResourceAccess, getUserHistory } = await import("@/server/services/downloads");
const { claimGuestDownload, getGuestDownloadsToday, newGuestId, parseGuestId } = await import("@/server/services/guest-downloads");
const { listResources, getDownloadCounts } = await import("@/server/services/resources");
const { registerUser, authenticate, DuplicateAccountError } = await import("@/server/services/users");
const { createTicket } = await import("@/server/services/support");
const { analysePdf, InvalidPdfError } = await import("@/server/pdf");

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

let resourceId: string;
let otherResourceIds: string[];

beforeAll(async () => {
  const db = await getDb();
  const [row] = await db
    .insert(resources)
    .values([
      {
        slug: "o-level-mathematics-paper-1-2023",
        title: "O-Level Mathematics Paper 1 (November 2023)",
        tier: "lower-secondary",
        level: "form-4",
        subject: "mathematics",
        resourceType: "past-paper",
        year: 2023,
        fileKey: "resources/a.pdf",
        fileSizeBytes: 1000,
        pageCount: 10,
        checksumSha256: "a".repeat(64),
      },
      {
        slug: "hidden-draft",
        title: "Hidden mathematics draft",
        tier: "lower-secondary",
        resourceType: "study-notes",
        fileKey: "resources/b.pdf",
        fileSizeBytes: 1000,
        pageCount: 3,
        checksumSha256: "b".repeat(64),
        isPublished: false,
      },
    ])
    .returning({ id: resources.id });
  resourceId = row!.id;

  const others = await db
    .insert(resources)
    .values(
      ["c", "d", "e"].map((c) => ({
        slug: `guest-test-${c}`,
        title: `Guest test ${c}`,
        tier: "lower-secondary",
        resourceType: "study-notes",
        fileKey: `resources/${c}.pdf`,
        fileSizeBytes: 1000,
        pageCount: 2,
        checksumSha256: c.repeat(64),
      })),
    )
    .returning({ id: resources.id });
  otherResourceIds = others.map((r) => r.id);
}, 60_000);

const learner = {
  role: "learner" as const,
  firstName: "Rufaro",
  surname: "Chikomo",
  email: "rufaro@example.com",
  password: "a-strong-password",
  confirmPassword: "a-strong-password",
  acceptTerms: "on" as const,
  dateOfBirth: "2010-05-01",
  gradeLevel: "form-3",
  guardianEmail: undefined,
};

describe("accounts", () => {
  it("registers, rejects duplicates and authenticates", async () => {
    const { id } = await registerUser(learner);
    expect(id).toMatch(/[0-9a-f-]{36}/);

    await expect(registerUser(learner)).rejects.toBeInstanceOf(DuplicateAccountError);

    expect(await authenticate(learner.email, learner.password)).toMatchObject({ ok: true, userId: id });
    expect(await authenticate(learner.email, "wrong-password")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("nobody@example.com", "whatever")).toEqual({ ok: false, reason: "invalid" });
  });

  it("detects duplicate EC numbers", async () => {
    const teacher = {
      role: "teacher" as const,
      firstName: "Nyasha",
      surname: "Dube",
      password: "a-strong-password",
      confirmPassword: "a-strong-password",
      acceptTerms: "on" as const,
      ecNumber: "7654321B",
      schoolName: "Chinhoyi High",
    };
    await registerUser({ ...teacher, email: "t1@example.com" });
    const error = await registerUser({ ...teacher, email: "t2@example.com" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicateAccountError);
    expect((error as InstanceType<typeof DuplicateAccountError>).field).toBe("ecNumber");
  });

  it("blocks suspended users", async () => {
    const db = await getDb();
    await db.update(users).set({ status: "suspended" }).where(eq(users.email, "t1@example.com"));
    expect(await authenticate("t1@example.com", "a-strong-password")).toEqual({ ok: false, reason: "suspended" });
  });
});

describe("download counter", () => {
  it("counts once per user per day, but logs every event", async () => {
    const db = await getDb();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, learner.email));

    const first = await recordResourceAccess({ resourceId, userId: user!.id, kind: "view" });
    const second = await recordResourceAccess({ resourceId, userId: user!.id, kind: "download" });
    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);

    const counts = await getDownloadCounts([resourceId]);
    expect(counts[resourceId]).toBe(1);

    const history = await getUserHistory(user!.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(resourceId);
  });
});

describe("guest download allowance", () => {
  it("allows one new file per guest per day, re-downloads free, and counts each guest once", async () => {
    const [a, b] = otherResourceIds as [string, string];
    const guest = newGuestId();
    expect(parseGuestId(guest)).toBe(guest);
    const before = (await getDownloadCounts([a]))[a]!;

    expect(await claimGuestDownload({ guestId: guest, resourceId: a, day: "2026-03-01" })).toMatchObject({ allowed: true, isNew: true });
    expect(await claimGuestDownload({ guestId: guest, resourceId: a, day: "2026-03-01" })).toMatchObject({ allowed: true, isNew: false });
    expect(await claimGuestDownload({ guestId: guest, resourceId: b, day: "2026-03-01" })).toMatchObject({ allowed: false });
    expect((await getDownloadCounts([a]))[a]).toBe(before + 1);
    expect(await getGuestDownloadsToday(guest, "2026-03-01")).toEqual([a]);

    // A new day, or a different guest, gets a fresh allowance.
    expect((await claimGuestDownload({ guestId: guest, resourceId: b, day: "2026-03-02" })).allowed).toBe(true);
    expect((await claimGuestDownload({ guestId: newGuestId(), resourceId: b, day: "2026-03-01" })).allowed).toBe(true);
  });

  it("lets only one of two parallel downloads of different files through", async () => {
    const guest = newGuestId();
    const results = await Promise.all(
      otherResourceIds.map((resourceId) => claimGuestDownload({ guestId: guest, resourceId, day: "2026-03-05" })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });

  it("rejects malformed guest ids", () => {
    expect(parseGuestId(undefined)).toBeNull();
    expect(parseGuestId("short")).toBeNull();
    expect(parseGuestId("x".repeat(22) + ";")).toBeNull();
  });
});

describe("catalogue search", () => {
  it("finds by prefix across title/subject/year and hides unpublished rows", async () => {
    const byPrefix = await listResources({ q: "mathem 2023", sort: "relevance", page: 1 });
    expect(byPrefix.items.map((r) => r.slug)).toEqual(["o-level-mathematics-paper-1-2023"]);

    const all = await listResources({ q: "mathematics", sort: "relevance", page: 1 });
    expect(all.items.some((r) => r.slug === "hidden-draft")).toBe(false);
  });

  it("returns nothing (not everything) for punctuation-only searches", async () => {
    expect((await listResources({ q: "&&&", sort: "relevance", page: 1 })).total).toBe(0);
  });

  it("clamps out-of-range pages", async () => {
    const r = await listResources({ sort: "popular", page: 99 });
    expect(r.page).toBe(1);
    expect(r.items.length).toBeGreaterThan(0);
  });
});

describe("support desk", () => {
  it("stores the ticket even when e-mail is not configured", async () => {
    const ticket = await createTicket({
      firstName: "Chipo",
      surname: "Ndlovu",
      email: "chipo@example.com",
      category: "downloads",
      message: "The paper will not open on my phone at all.",
      userId: null,
      ipHash: "test",
    });
    expect(ticket.reference).toMatch(/^ZCH-[2-9A-HJ-NP-Z]{6}$/);
    expect(ticket.deliveryStatus).toBe("not_configured");
  });
});

describe("PDF processing", () => {
  it("counts pages and builds a 2-page guest preview", async () => {
    const analysed = await analysePdf(await makePdf(7), 2);
    expect(analysed.pageCount).toBe(7);
    expect(analysed.checksum).toMatch(/^[0-9a-f]{64}$/);
    const preview = await PDFDocument.load(analysed.preview!);
    expect(preview.getPageCount()).toBe(2);
  });

  it("handles documents shorter than the preview", async () => {
    const analysed = await analysePdf(await makePdf(1), 2);
    expect((await PDFDocument.load(analysed.preview!)).getPageCount()).toBe(1);
  });

  it("rejects non-PDF uploads", async () => {
    await expect(analysePdf(new TextEncoder().encode("MZ fake exe"), 2)).rejects.toBeInstanceOf(InvalidPdfError);
    await expect(analysePdf(new TextEncoder().encode("%PDF-1.7 truncated garbage"), 2)).rejects.toBeInstanceOf(InvalidPdfError);
  });
});
