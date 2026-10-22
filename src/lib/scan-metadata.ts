/**
 * Suggests catalogue details for a scanned paper from its OCR text.
 *
 * Exam covers are formulaic ("ZIMBABWE SCHOOL EXAMINATIONS COUNCIL · General
 * Certificate of Education Ordinary Level · MATHEMATICS 4004/1 · PAPER 1 ·
 * NOVEMBER 2019"), so plain pattern matching gets most fields right. Output is
 * a *suggestion* for a human to confirm, never published unreviewed. Used by
 * scripts/process-scans.ts; pure so it is unit-tested (tests/scan-metadata.test.ts).
 */
import { TIERS, type ExamSession, type TierSlug } from "./curriculum";

export interface ScanMetadata {
  board: "zimsec" | "cambridge" | null;
  tier: TierSlug | null;
  level: string | null;
  subject: string | null;
  /** Null when the cover has no exam markings (e.g. notes): the reviewer picks the type. */
  resourceType: "past-paper" | "specimen-paper" | "marking-scheme" | null;
  paperNumber: number | null;
  examSession: ExamSession | null;
  year: number | null;
  /** Suggested catalogue title, in the same style as existing resources. */
  title: string;
  /** Fields that could not be read, for the reviewer's attention. */
  missing: string[];
}

/** Only the cover is reliable: subject words also appear inside questions. */
const COVER_CHARS = 1500;

/** Cover wording that differs from the catalogue's subject names. */
const SUBJECT_ALIASES: Record<string, string> = {
  "principles of accounts": "principles-of-accounting",
  "accounts": "principles-of-accounting",
  "business enterprise and skills": "business-enterprise-and-skills",
  "family and religious studies": "family-religion-and-moral-education",
  "religious studies": "family-religion-and-moral-education",
  "computer studies": "computer-science",
  "ndebele": "indigenous-languages",
  "shona": "indigenous-languages",
  "tonga": "indigenous-languages",
};

const LEVELS: { pattern: RegExp; tier: TierSlug; level: string; label: string }[] = [
  { pattern: /\bordinary\s+level\b|\bo[\s-]?level\b/i, tier: "lower-secondary", level: "form-4", label: "O-Level" },
  { pattern: /\badvanced\s+(?:subsidiary\s+)?level\b|\ba[\s-]?level\b/i, tier: "upper-secondary", level: "form-6", label: "A-Level" },
  { pattern: /\bgrade\s*(?:7|seven)\b/i, tier: "junior", level: "grade-7", label: "Grade 7" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    pattern: new RegExp(`\\bform\\s*${n}\\b`, "i"),
    tier: (n <= 4 ? "lower-secondary" : "upper-secondary") as TierSlug,
    level: `form-${n}`,
    label: `Form ${n}`,
  })),
];

const MONTHS: Record<string, ExamSession> = { june: "june", jun: "june", november: "november", nov: "november" };
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

export function suggestScanMetadata(text: string): ScanMetadata {
  // OCR often splits words with odd spacing; normalise whitespace once.
  const cover = text.slice(0, COVER_CHARS).replace(/\s+/g, " ");

  const board = /zimbabwe\s+school\s+examinations?\s+council|\bzimsec\b/i.test(cover)
    ? "zimsec"
    : /\bcambridge\b|\bucles\b/i.test(cover)
      ? "cambridge"
      : null;

  // The earliest level mention wins (an A-Level cover may mention "O-Level" in instructions later on).
  const levelHit = LEVELS.map((l) => ({ ...l, index: cover.search(l.pattern) }))
    .filter((l) => l.index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  const { examSession, year } = findSession(cover);
  const paperNumber = findPaperNumber(cover);
  const resourceType = /\bmark(?:ing)?\s+scheme\b/i.test(cover)
    ? "marking-scheme"
    : /\bspecimen\b/i.test(cover)
      ? "specimen-paper"
      : board || examSession || paperNumber
        ? "past-paper"
        : null;
  const subject = findSubject(cover, levelHit?.tier ?? null);

  const subjectName = subject ? subjectLabel(subject.tier, subject.slug) : null;
  const levelLabel = levelHit?.label ?? null;
  const title = buildTitle({ levelLabel, subjectName, paperNumber, resourceType, examSession, year });

  const missing: string[] = [];
  if (!resourceType) missing.push("type");
  if (!levelHit) missing.push("level");
  if (!subject) missing.push("subject");
  // Paper number, year and session only matter for exam papers.
  if (resourceType) {
    if (!paperNumber) missing.push("paper number");
    if (!year) missing.push("year");
    if (!examSession && resourceType !== "specimen-paper") missing.push("exam session");
  }

  return {
    board,
    tier: levelHit?.tier ?? subject?.tier ?? null,
    level: levelHit?.level ?? null,
    subject: subject?.slug ?? null,
    resourceType,
    paperNumber,
    examSession,
    year,
    title,
    missing,
  };
}

function findSession(cover: string): { examSession: ExamSession | null; year: number | null } {
  // "NOVEMBER 2019", "Nov 2019", "2019 November"
  const monthYear = /\b(june?|nov(?:ember)?)\b[\s,/-]*((?:19|20)\d{2})\b/i.exec(cover);
  if (monthYear) return { examSession: MONTHS[monthYear[1]!.toLowerCase()] ?? null, year: Number(monthYear[2]) };
  const yearMonth = /\b((?:19|20)\d{2})[\s,/-]*(june?|nov(?:ember)?)\b/i.exec(cover);
  if (yearMonth) return { examSession: MONTHS[yearMonth[2]!.toLowerCase()] ?? null, year: Number(yearMonth[1]) };
  // ZIMSEC copyright line: "©ZIMSEC N2019" / "J2021"
  const code = /\b([NJ])((?:19|20)\d{2})\b/.exec(cover);
  if (code) return { examSession: code[1] === "N" ? "november" : "june", year: Number(code[2]) };
  const bare = /\b((?:19|20)\d{2})\b/.exec(cover);
  return { examSession: null, year: bare ? Number(bare[1]) : null };
}

function findPaperNumber(cover: string): number | null {
  const word = /\bpaper\s+(\d|i{1,3}|iv|vi?)\b/i.exec(cover);
  if (word) {
    const raw = word[1]!.toLowerCase();
    const n = /\d/.test(raw) ? Number(raw) : (ROMAN[raw] ?? 0);
    if (n >= 1 && n <= 9) return n;
  }
  // Subject code with component: "4004/1", "6042/2"
  const code = /\b\d{4}\s*\/\s*(\d)\b/.exec(cover);
  return code ? Number(code[1]) : null;
}

function findSubject(cover: string, tier: TierSlug | null): { tier: TierSlug; slug: string } | null {
  const lower = cover.toLowerCase().replace(/&/g, "and");
  const tiers = tier ? [tier] : (["lower-secondary", "upper-secondary", "junior"] as TierSlug[]);

  for (const t of tiers) {
    const subjects = TIERS.find((x) => x.slug === t)?.subjects ?? [];
    const candidates = [
      ...subjects.map((s) => ({ phrase: s.name.toLowerCase().replace(/&/g, "and").replace(/,/g, ""), slug: s.slug })),
      ...Object.entries(SUBJECT_ALIASES)
        .filter(([, slug]) => subjects.some((s) => s.slug === slug))
        .map(([phrase, slug]) => ({ phrase, slug })),
    ];
    // Earliest mention on the cover wins; on a tie the longer phrase ("Pure Mathematics" over "Mathematics").
    let best: { slug: string; index: number; length: number } | null = null;
    for (const c of candidates) {
      const index = lower.search(new RegExp(`\\b${escapeRegExp(c.phrase).replace(/ /g, "\\s+")}\\b`));
      if (index < 0) continue;
      if (!best || index < best.index || (index === best.index && c.phrase.length > best.length)) {
        best = { slug: c.slug, index, length: c.phrase.length };
      }
    }
    if (best) return { tier: t, slug: best.slug };
  }
  return null;
}

function subjectLabel(tier: TierSlug, slug: string): string | null {
  return TIERS.find((t) => t.slug === tier)?.subjects.find((s) => s.slug === slug)?.name ?? null;
}

function buildTitle(p: {
  levelLabel: string | null;
  subjectName: string | null;
  paperNumber: number | null;
  resourceType: ScanMetadata["resourceType"];
  examSession: ExamSession | null;
  year: number | null;
}): string {
  const parts = [p.levelLabel, p.subjectName ?? "Unknown subject"];
  if (p.resourceType === "specimen-paper") parts.push("Specimen");
  if (p.paperNumber) parts.push(`Paper ${p.paperNumber}`);
  if (p.resourceType === "marking-scheme") parts.push("Marking Scheme");
  const when = [p.examSession === "june" ? "June" : p.examSession === "november" ? "November" : null, p.year]
    .filter(Boolean)
    .join(" ");
  return `${parts.filter(Boolean).join(" ")}${when ? ` (${when})` : ""}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Similarity of two OCR texts (0–1), from overlapping 3-word shingles. The same
 * paper scanned by two people scores high even though the files differ byte-for-byte.
 */
export function textSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / (sa.size + sb.size - shared);
}

function shingles(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}
