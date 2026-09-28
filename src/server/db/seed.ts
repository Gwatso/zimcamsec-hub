/**
 * Idempotent seeding:
 *  1. Bootstrap Master Admin from ADMIN_EMAIL / ADMIN_PASSWORD (a well-known
 *     development default is used only outside production).
 *  2. Optional demo catalogue (SEED_DEMO_CONTENT) with generated sample PDFs
 *     so a fresh checkout is explorable. Never enable in production — demo
 *     download counts are illustrative, not real engagement.
 */
import { count, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { GUEST_PREVIEW_PAGES } from "@/lib/access";
import { type Audience, type ResourceTypeSlug, type TierSlug, defaultAudienceFor } from "@/lib/curriculum";
import { slugify } from "@/lib/format";
import { hashPassword } from "../auth/password";
import { getEnv } from "../env";
import { analysePdf } from "../pdf";
import { getStorage } from "../storage";
import type { Db } from "./client";
import { resources, users } from "./schema";

const DEV_ADMIN_EMAIL = "admin@zimcamsec.local";
const DEV_ADMIN_PASSWORD = "zimcamsec-admin-2026";

export async function seedDatabase(db: Db, options: { demoContent: boolean }): Promise<void> {
  const adminId = await ensureAdmin(db);
  if (options.demoContent) await seedDemoResources(db, adminId);
}

async function ensureAdmin(db: Db): Promise<string | null> {
  const env = getEnv();
  let email = env.ADMIN_EMAIL;
  let password = env.ADMIN_PASSWORD;

  if (!email || !password) {
    if (env.NODE_ENV === "production") {
      return null; // No implicit admin in production.
    }
    email = DEV_ADMIN_EMAIL;
    password = DEV_ADMIN_PASSWORD;
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      firstName: "Master",
      surname: "Admin",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (created && email === DEV_ADMIN_EMAIL) {
    console.warn(`[seed] Created development admin ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD} — do not use in production.`);
  }
  return created?.id ?? null;
}

interface DemoResource {
  title: string;
  tier: TierSlug;
  level?: string;
  subject?: string;
  type: ResourceTypeSlug;
  year?: number;
  session?: "june" | "november";
  paper?: number;
  pages: number;
  downloads: number;
  audience?: Audience;
  description: string;
}

const DEMO: DemoResource[] = [
  { title: "ECD B Early Literacy Activity Book", tier: "infant", level: "ecd-b", subject: "english", type: "study-notes", pages: 6, downloads: 412, description: "Letter recognition, phonics and tracing activities for early learners." },
  { title: "Grade 2 Numeracy Practice Worksheets", tier: "infant", level: "grade-2", subject: "mathematics", type: "study-notes", pages: 5, downloads: 655, description: "Counting, addition and subtraction within 100 with visual aids." },
  { title: "Grade 1 Indigenous Languages Scheme of Work (Term 1)", tier: "infant", level: "grade-1", subject: "indigenous-languages", type: "scheme-of-work", pages: 4, downloads: 188, description: "Weekly objectives, activities and assessment ideas for Term 1." },
  { title: "Grade 7 Mathematics Specimen Paper 1", tier: "junior", level: "grade-7", subject: "mathematics", type: "specimen-paper", year: 2024, paper: 1, pages: 8, downloads: 2310, description: "Specimen paper aligned to the Heritage-Based Curriculum Grade 7 assessment format." },
  { title: "Grade 7 English Paper 2 (November 2023)", tier: "junior", level: "grade-7", subject: "english", type: "past-paper", year: 2023, session: "november", paper: 2, pages: 7, downloads: 1874, description: "Comprehension, composition and language usage." },
  { title: "Grade 6 Science & Technology Study Notes", tier: "junior", level: "grade-6", subject: "science-and-technology", type: "study-notes", pages: 9, downloads: 967, description: "Materials, energy, the human body and simple machines, with revision questions." },
  { title: "Grade 5 Agriculture Scheme of Work (Term 2)", tier: "junior", level: "grade-5", subject: "agriculture", type: "scheme-of-work", pages: 4, downloads: 143, description: "Crop husbandry and small livestock units with practical activities." },
  { title: "O-Level Mathematics Paper 1 (November 2023)", tier: "lower-secondary", level: "form-4", subject: "mathematics", type: "past-paper", year: 2023, session: "november", paper: 1, pages: 12, downloads: 5421, description: "Non-calculator paper covering number, algebra, geometry and statistics." },
  { title: "O-Level Mathematics Paper 2 (June 2023)", tier: "lower-secondary", level: "form-4", subject: "mathematics", type: "past-paper", year: 2023, session: "june", paper: 2, pages: 14, downloads: 3988, description: "Structured questions with extended problem solving." },
  { title: "O-Level Combined Science Specimen Paper", tier: "lower-secondary", level: "form-4", subject: "combined-science", type: "specimen-paper", year: 2024, paper: 1, pages: 10, downloads: 2764, description: "Biology, chemistry and physics sections with multiple choice and structured items." },
  { title: "Form 3 Heritage Studies Revision Notes", tier: "lower-secondary", level: "form-3", subject: "heritage-studies", type: "study-notes", pages: 11, downloads: 1532, description: "National identity, heritage sites, the Constitution and civic responsibilities." },
  { title: "O-Level Commerce Paper 2 (June 2022)", tier: "lower-secondary", level: "form-4", subject: "commerce", type: "past-paper", year: 2022, session: "june", paper: 2, pages: 6, downloads: 1204, description: "Trade, banking, insurance and transport essay questions." },
  { title: "Form 1 Computer Science Teacher Syllabus", tier: "lower-secondary", level: "form-1", subject: "computer-science", type: "teacher-syllabus", pages: 6, downloads: 321, description: "Learning outcomes, suggested practicals and assessment weighting." },
  { title: "Form 4 Geography Scheme of Work", tier: "lower-secondary", level: "form-4", subject: "geography", type: "scheme-of-work", pages: 5, downloads: 276, description: "Physical and human geography topics mapped to weekly lessons." },
  { title: "A-Level Pure Mathematics Paper 1 (November 2023)", tier: "upper-secondary", level: "form-6", subject: "pure-mathematics", type: "past-paper", year: 2023, session: "november", paper: 1, pages: 10, downloads: 1893, description: "Algebra, calculus, trigonometry and vectors." },
  { title: "A-Level Accounting Specimen Paper", tier: "upper-secondary", level: "form-6", subject: "accounting", type: "specimen-paper", year: 2024, paper: 2, pages: 9, downloads: 1127, description: "Financial statements, partnerships and company accounts." },
  { title: "Form 5 History Notes: Southern Africa 1800–1900", tier: "upper-secondary", level: "form-5", subject: "history", type: "study-notes", pages: 13, downloads: 842, description: "State formation, colonial encroachment and resistance." },
  { title: "A-Level Physics Teacher Syllabus", tier: "upper-secondary", level: "form-5", subject: "physics", type: "teacher-syllabus", pages: 7, downloads: 214, description: "Topic sequencing, practical requirements and assessment objectives." },
  { title: "Heritage-Based Curriculum Framework 2024–2030 Overview", tier: "policy", subject: "curriculum-frameworks", type: "framework", year: 2024, pages: 8, downloads: 3120, description: "Summary of the curriculum framework, learning areas and assessment model." },
  { title: "Continuous Assessment Learning Activities (CALA) Guidelines", tier: "policy", subject: "circulars", type: "admin-circular", year: 2024, pages: 5, downloads: 1466, description: "Administrative guidance for schools on CALA implementation and moderation." },
  { title: "National ICT Strategy for Schools", tier: "policy", subject: "ict-strategy", type: "ict-strategy", year: 2023, pages: 9, downloads: 688, description: "Connectivity, devices, digital skills and e-learning priorities." },
  { title: "Examination Candidate Registration Guidelines", tier: "policy", subject: "examination-guidelines", type: "exam-guideline", year: 2025, pages: 4, downloads: 2041, description: "Registration timelines, required documents and fees guidance for candidates." },
];

async function seedDemoResources(db: Db, adminId: string | null): Promise<void> {
  const [existing] = await db.select({ n: count() }).from(resources);
  if ((existing?.n ?? 0) > 0) return;

  const storage = getStorage();
  console.info(`[seed] Creating ${DEMO.length} demo resources…`);

  for (const item of DEMO) {
    const bytes = await buildDemoPdf(item);
    const analysed = await analysePdf(bytes, GUEST_PREVIEW_PAGES);
    const fileKey = `resources/${analysed.checksum}.pdf`;
    const previewKey = analysed.preview ? `previews/${analysed.checksum}-p${GUEST_PREVIEW_PAGES}.pdf` : null;
    await storage.put(fileKey, bytes);
    if (previewKey && analysed.preview) await storage.put(previewKey, analysed.preview);

    await db
      .insert(resources)
      .values({
        slug: slugify(item.title),
        title: item.title,
        description: `${item.description} (Demo content.)`,
        tier: item.tier,
        level: item.level ?? null,
        subject: item.subject ?? null,
        resourceType: item.type,
        audience: item.audience ?? defaultAudienceFor(item.type),
        year: item.year ?? null,
        examSession: item.session ?? null,
        paperNumber: item.paper ?? null,
        fileKey,
        previewKey,
        fileSizeBytes: bytes.byteLength,
        pageCount: analysed.pageCount,
        checksumSha256: analysed.checksum,
        downloadCount: item.downloads,
        createdBy: adminId,
      })
      .onConflictDoNothing();
  }
}

/** Generates a lightweight, clearly-labelled sample PDF. */
async function buildDemoPdf(item: DemoResource): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(item.title);
  doc.setProducer("Zimcamsec Hub demo seed");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0x4f / 255, 0x79 / 255, 0x42 / 255);
  const gold = rgb(0xd4 / 255, 0xaf / 255, 0x37 / 255);
  // Standard fonts are WinAnsi-encoded; keep generated text ASCII-safe.
  const ascii = (s: string) => s.replace(/[–—]/g, "-").replace(/[^\x20-\x7e]/g, "");

  for (let i = 1; i <= item.pages; i++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: green });
    page.drawRectangle({ x: 0, y: 778, width: 595, height: 4, color: gold });
    page.drawText("ZIMCAMSEC HUB  |  DEMO CONTENT", { x: 40, y: 806, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(ascii(item.title), { x: 40, y: 740, size: 16, font: bold, maxWidth: 515 });
    page.drawText(`Page ${i} of ${item.pages}`, { x: 40, y: 716, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

    let y = 680;
    for (let q = 1; q <= 8; q++) {
      const n = (i - 1) * 8 + q;
      page.drawText(`${n}.  Sample question ${n}: this placeholder text demonstrates layout only.`, {
        x: 40,
        y,
        size: 11,
        font,
        maxWidth: 515,
      });
      y -= 22;
      page.drawLine({ start: { x: 58, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });
      y -= 48;
    }
    page.drawText("Generated sample document for demonstration. Not an official examination paper.", {
      x: 40,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  return doc.save({ useObjectStreams: true });
}
