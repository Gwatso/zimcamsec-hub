/**
 * Heritage-Based Curriculum (HBC) taxonomy.
 *
 * The taxonomy lives in code rather than the database: it changes at most once
 * per curriculum cycle, is needed on every page (navigation, filters, badges),
 * and being a typed constant means invalid tier/level/subject values are caught
 * by validation before they ever reach the database.
 */

export const TIER_SLUGS = ["infant", "junior", "lower-secondary", "upper-secondary", "policy"] as const;
export type TierSlug = (typeof TIER_SLUGS)[number];

export interface Level {
  slug: string;
  label: string;
}

export interface Subject {
  slug: string;
  name: string;
  /** Upper-secondary career pathway, or a grouping label for other tiers. */
  group?: string;
}

export interface Tier {
  slug: TierSlug;
  code: string;
  title: string;
  range: string;
  summary: string;
  levels: Level[];
  subjects: Subject[];
}

const s = (name: string, group?: string): Subject => ({
  slug: name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, ""),
  name,
  group,
});

export const TIERS: readonly Tier[] = [
  {
    slug: "infant",
    code: "Tier 01",
    title: "Infant Level",
    range: "ECD A – Grade 2",
    summary:
      "Foundational literacy, numeracy, indigenous languages, visual arts and physical education.",
    levels: [
      { slug: "ecd-a", label: "ECD A" },
      { slug: "ecd-b", label: "ECD B" },
      { slug: "grade-1", label: "Grade 1" },
      { slug: "grade-2", label: "Grade 2" },
    ],
    subjects: [
      s("Indigenous Languages"),
      s("English"),
      s("Mathematics"),
      s("Visual & Performing Arts"),
      s("Physical Education"),
      s("Heritage-Social Studies"),
      s("Science & Technology"),
    ],
  },
  {
    slug: "junior",
    code: "Tier 02",
    title: "Junior Level",
    range: "Grade 3 – Grade 7",
    summary:
      "Primary education including agriculture, science and technology, social sciences and national heritage studies.",
    levels: [3, 4, 5, 6, 7].map((g) => ({ slug: `grade-${g}`, label: `Grade ${g}` })),
    subjects: [
      s("English"),
      s("Indigenous Languages"),
      s("Mathematics"),
      s("Science & Technology"),
      s("Social Sciences"),
      s("Heritage Studies"),
      s("Agriculture"),
      s("Family, Religion & Moral Education"),
      s("Visual & Performing Arts"),
      s("Physical Education"),
      s("ICT"),
    ],
  },
  {
    slug: "lower-secondary",
    code: "Tier 03",
    title: "Lower Secondary",
    range: "Form 1 – Form 4 (O-Level)",
    summary:
      "Ordinary Level compulsory core subjects and elective pathways across STEM, Commercials and Technical subjects.",
    levels: [1, 2, 3, 4].map((f) => ({ slug: `form-${f}`, label: `Form ${f}` })),
    subjects: [
      s("Mathematics", "Core"),
      s("English Language", "Core"),
      s("Indigenous Languages", "Core"),
      s("Combined Science", "Core"),
      s("Heritage Studies", "Core"),
      s("Physics", "STEM"),
      s("Chemistry", "STEM"),
      s("Biology", "STEM"),
      s("Computer Science", "STEM"),
      s("Agriculture", "STEM"),
      s("Geography", "Humanities"),
      s("History", "Humanities"),
      s("Literature in English", "Humanities"),
      s("Family, Religion & Moral Education", "Humanities"),
      s("Commerce", "Commercials"),
      s("Principles of Accounting", "Commercials"),
      s("Business Enterprise & Skills", "Commercials"),
      s("Economics", "Commercials"),
      s("Technical Graphics", "Technical"),
      s("Food Technology & Design", "Technical"),
      s("Wood Technology & Design", "Technical"),
      s("Metal Technology & Design", "Technical"),
      s("Music", "Creative Arts"),
      s("Art", "Creative Arts"),
    ],
  },
  {
    slug: "upper-secondary",
    code: "Tier 04",
    title: "Upper Secondary",
    range: "Form 5 – Form 6 (A-Level)",
    summary:
      "Specialised career pathways: STEAM, Commercial Sciences, Humanities, Design & Technology and Creative Arts.",
    levels: [5, 6].map((f) => ({ slug: `form-${f}`, label: `Form ${f}` })),
    subjects: [
      s("Pure Mathematics", "STEAM"),
      s("Statistics", "STEAM"),
      s("Physics", "STEAM"),
      s("Chemistry", "STEAM"),
      s("Biology", "STEAM"),
      s("Computer Science", "STEAM"),
      s("Geography", "STEAM"),
      s("Accounting", "Commercial Sciences"),
      s("Business Studies", "Commercial Sciences"),
      s("Economics", "Commercial Sciences"),
      s("History", "Humanities"),
      s("Literature in English", "Humanities"),
      s("Sociology", "Humanities"),
      s("Family, Religion & Moral Education", "Humanities"),
      s("Indigenous Languages", "Humanities"),
      s("Technical Graphics & Design", "Design & Technology"),
      s("Building Technology & Design", "Design & Technology"),
      s("Music", "Creative Arts"),
      s("Art", "Creative Arts"),
      s("Theatre Arts", "Creative Arts"),
    ],
  },
  {
    slug: "policy",
    code: "Module 05",
    title: "Policy, Circulars & ICT Strategy Hub",
    range: "All levels",
    summary:
      "Ministry circulars, national ICT blueprints, examination guidelines and statutory instruments.",
    levels: [],
    subjects: [
      s("Circulars"),
      s("ICT Strategy"),
      s("Examination Guidelines"),
      s("Statutory Instruments"),
      s("Curriculum Frameworks"),
    ],
  },
];

export const RESOURCE_TYPES = [
  { slug: "past-paper", label: "Past Paper", audience: "public" },
  { slug: "specimen-paper", label: "Specimen Paper", audience: "public" },
  { slug: "marking-scheme", label: "Marking Scheme", audience: "educator" },
  { slug: "study-notes", label: "Study Notes", audience: "public" },
  { slug: "textbook", label: "Textbook", audience: "public" },
  { slug: "syllabus", label: "Syllabus", audience: "public" },
  { slug: "teacher-syllabus", label: "Teacher Syllabus", audience: "educator" },
  { slug: "scheme-of-work", label: "Scheme of Work", audience: "educator" },
  { slug: "framework", label: "Curriculum Framework", audience: "public" },
  { slug: "circular", label: "Circular", audience: "public" },
  { slug: "admin-circular", label: "Administrative Circular", audience: "educator" },
  { slug: "ict-strategy", label: "ICT Strategy", audience: "public" },
  { slug: "exam-guideline", label: "Examination Guideline", audience: "public" },
  { slug: "statutory-instrument", label: "Statutory Instrument", audience: "public" },
] as const satisfies readonly { slug: string; label: string; audience: Audience }[];

export type ResourceTypeSlug = (typeof RESOURCE_TYPES)[number]["slug"];
export type Audience = "public" | "educator";

export const RESOURCE_TYPE_SLUGS = RESOURCE_TYPES.map((t) => t.slug) as [
  ResourceTypeSlug,
  ...ResourceTypeSlug[],
];

export const EXAM_SESSIONS = ["june", "november"] as const;
export type ExamSession = (typeof EXAM_SESSIONS)[number];

const tierMap = new Map(TIERS.map((t) => [t.slug, t]));
const typeMap = new Map<string, (typeof RESOURCE_TYPES)[number]>(RESOURCE_TYPES.map((t) => [t.slug, t]));

export function isTierSlug(value: unknown): value is TierSlug {
  return typeof value === "string" && tierMap.has(value as TierSlug);
}

export function getTier(slug: string): Tier | undefined {
  return tierMap.get(slug as TierSlug);
}

export function getLevel(tier: string, level: string | null | undefined): Level | undefined {
  if (!level) return undefined;
  return getTier(tier)?.levels.find((l) => l.slug === level);
}

export function getSubject(tier: string, subject: string | null | undefined): Subject | undefined {
  if (!subject) return undefined;
  return getTier(tier)?.subjects.find((x) => x.slug === subject);
}

export function getResourceType(slug: string) {
  return typeMap.get(slug);
}

export function isResourceTypeSlug(value: unknown): value is ResourceTypeSlug {
  return typeof value === "string" && typeMap.has(value);
}

export function defaultAudienceFor(type: ResourceTypeSlug): Audience {
  return typeMap.get(type)?.audience ?? "public";
}

/** All learner grade levels across the four teaching tiers, for registration. */
export const LEARNER_LEVELS: { tier: TierSlug; tierTitle: string; level: Level }[] = TIERS.filter(
  (t) => t.slug !== "policy",
).flatMap((t) => t.levels.map((level) => ({ tier: t.slug, tierTitle: t.title, level })));

export function isLearnerLevel(slug: unknown): boolean {
  return typeof slug === "string" && LEARNER_LEVELS.some((l) => l.level.slug === slug);
}

/** Human label for a level slug regardless of tier (level slugs are globally unique). */
export function levelLabel(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  return LEARNER_LEVELS.find((l) => l.level.slug === slug)?.level.label;
}
