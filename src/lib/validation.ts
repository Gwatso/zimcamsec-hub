/**
 * Input schemas shared by forms (client hints) and Server Actions / route
 * handlers (authoritative validation). Every external input is parsed here.
 */
import { z } from "zod";
import {
  EXAM_SESSIONS,
  RESOURCE_TYPE_SLUGS,
  TIER_SLUGS,
  getLevel,
  getSubject,
  getTier,
  isLearnerLevel,
} from "./curriculum";
import { ageOn, harareDate } from "./dates";

export const LEARNER_MAX_AGE = 17;
export const LEARNER_MIN_AGE = 3;
/** Learners younger than this must supply a parent/guardian e-mail. */
export const GUARDIAN_REQUIRED_UNDER = 13;

const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer`);

const name = trimmed(60)
  .min(1, "Required")
  .regex(/^[\p{L}\p{M}' .-]+$/u, "Use letters, spaces, apostrophes or hyphens only");

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail is too long")
  .email("Enter a valid e-mail address");

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use 128 characters or fewer");

/** Optional form field: empty strings become undefined. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
});

/**
 * Zimbabwe EC (Employment Code) numbers: digits followed by a check letter,
 * e.g. "1234567A". Spaces/hyphens and lowercase are normalised away.
 */
export function normalizeEcNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}
export const EC_NUMBER_PATTERN = /^\d{6,8}[A-Z]$/;

const accountBase = z.object({
  firstName: name,
  surname: name,
  email,
  password,
  confirmPassword: z.string(),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "You must accept the terms to continue" }) }),
});

const learnerSchema = accountBase.extend({
  role: z.literal("learner"),
  dateOfBirth: z.string().trim().min(1, "Enter your date of birth"),
  gradeLevel: z.string().refine(isLearnerLevel, "Choose your grade or form"),
  guardianEmail: optional(email),
});

const teacherSchema = accountBase.extend({
  role: z.literal("teacher"),
  ecNumber: z
    .string()
    .transform(normalizeEcNumber)
    .refine((v) => EC_NUMBER_PATTERN.test(v), "Enter a valid EC Number, e.g. 1234567A"),
  schoolName: trimmed(120).min(2, "Enter your school name"),
});

export const registerSchema = z
  .discriminatedUnion("role", [learnerSchema, teacherSchema], {
    errorMap: () => ({ message: "Choose Learner or Teacher" }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
    const emailName = data.email.split("@")[0] ?? "";
    if (emailName.length >= 4 && data.password.toLowerCase().includes(emailName)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password must not contain your e-mail name" });
    }
    if (data.role === "learner") {
      const age = ageOn(data.dateOfBirth, harareDate());
      if (age === null) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date of birth" });
        return;
      }
      if (age > LEARNER_MAX_AGE) {
        ctx.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message: `Learner accounts are for learners aged ${LEARNER_MAX_AGE} and under. Educators should register as a Teacher.`,
        });
      } else if (age < LEARNER_MIN_AGE) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Please check the date of birth" });
      } else if (age < GUARDIAN_REQUIRED_UNDER && !data.guardianEmail) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianEmail"],
          message: `Learners under ${GUARDIAN_REQUIRED_UNDER} need a parent or guardian e-mail`,
        });
      }
      if (data.guardianEmail && data.guardianEmail === data.email) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianEmail"],
          message: "Guardian e-mail must be different from the learner's e-mail",
        });
      }
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Support desk
// ---------------------------------------------------------------------------

export const SUPPORT_CATEGORIES = [
  { value: "account", label: "Account & sign-in" },
  { value: "downloads", label: "Downloads & PDF viewer" },
  { value: "missing-resource", label: "Request a missing resource" },
  { value: "teacher-verification", label: "Teacher verification" },
  { value: "content-error", label: "Report an error in a resource" },
  { value: "copyright", label: "Copyright / takedown request" },
  { value: "offline", label: "Offline & Data-Saver mode" },
  { value: "other", label: "Something else" },
] as const;

export const supportSchema = z.object({
  firstName: name,
  surname: name,
  email,
  phone: optional(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s()-]/g, ""))
      .refine((v) => /^\+?\d{9,15}$/.test(v), "Enter a valid phone number, e.g. +263 77 123 4567"),
  ),
  category: z.enum(SUPPORT_CATEGORIES.map((c) => c.value) as [string, ...string[]], {
    errorMap: () => ({ message: "Choose a subject" }),
  }),
  message: z.string().trim().min(20, "Please give a bit more detail (at least 20 characters)").max(5000),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(0).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Catalogue query-string parsing (never throws: bad params are ignored)
// ---------------------------------------------------------------------------

export const SORTS = ["relevance", "popular", "newest", "title"] as const;
export type Sort = (typeof SORTS)[number];

const MAX_PAGE = 500;

export const catalogueQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional().catch(undefined),
    tier: z.enum(TIER_SLUGS).optional().catch(undefined),
    level: z.string().max(40).optional().catch(undefined),
    subject: z.string().max(60).optional().catch(undefined),
    type: z.enum(RESOURCE_TYPE_SLUGS).optional().catch(undefined),
    year: z.coerce.number().int().min(1980).max(2100).optional().catch(undefined),
    sort: z.enum(SORTS).optional().catch(undefined),
    page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1).default(1),
    view: z.enum(["grid", "list"]).catch("grid").default("grid"),
  })
  .transform((v) => {
    // Level/subject only make sense inside a valid tier.
    const level = v.tier && getLevel(v.tier, v.level) ? v.level : undefined;
    const subject = v.tier && getSubject(v.tier, v.subject) ? v.subject : undefined;
    const q = v.q ? v.q : undefined;
    const sort: Sort = v.sort === "relevance" && !q ? "popular" : (v.sort ?? (q ? "relevance" : "popular"));
    return { ...v, q, level, subject, sort };
  });

export type CatalogueQuery = z.output<typeof catalogueQuerySchema>;

/** Flattens Next.js searchParams (string | string[]) into first values. */
export function firstValues(params: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Admin resource upload
// ---------------------------------------------------------------------------

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_COVER_BYTES = 300 * 1024;

export const resourceMetadataSchema = z
  .object({
    title: trimmed(160).min(5, "Title is too short"),
    description: trimmed(2000).default(""),
    tier: z.enum(TIER_SLUGS, { errorMap: () => ({ message: "Choose a tier" }) }),
    level: optional(z.string().max(40)),
    subject: optional(z.string().max(60)),
    resourceType: z.enum(RESOURCE_TYPE_SLUGS, { errorMap: () => ({ message: "Choose a resource type" }) }),
    audience: z.enum(["public", "educator"]),
    year: optional(z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1)),
    examSession: optional(z.enum(EXAM_SESSIONS)),
    paperNumber: optional(z.coerce.number().int().min(1).max(9)),
    isPublished: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .superRefine((data, ctx) => {
    const tier = getTier(data.tier);
    if (!tier) return;
    if (data.level && !getLevel(data.tier, data.level)) {
      ctx.addIssue({ code: "custom", path: ["level"], message: `Not a ${tier.title} level` });
    }
    if (data.subject && !getSubject(data.tier, data.subject)) {
      ctx.addIssue({ code: "custom", path: ["subject"], message: `Not a ${tier.title} subject` });
    }
  });

export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;

// ---------------------------------------------------------------------------
// Client telemetry
// ---------------------------------------------------------------------------

export const telemetrySchema = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(["error", "unhandledrejection", "react"]),
        message: z.string().max(1000),
        stack: z.string().max(8000).optional(),
        url: z.string().max(1000).optional(),
        at: z.number().int().optional(),
      }),
    )
    .min(1)
    .max(20),
});

/** Maps a ZodError into `{ field: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
