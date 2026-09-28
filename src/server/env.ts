/**
 * Typed, validated environment. Parsed once, lazily, so `next build` does not
 * require runtime secrets. Empty strings are treated as "unset".
 */
import { z } from "zod";

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true" || v === "1"));

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  PGLITE_DIR: z.string().default("./.data/pglite"),
  AUTO_MIGRATE: bool(true),
  STORAGE_DIR: z.string().default("./storage"),
  SUPPORT_INBOX: z.string().email().default("edu.novacacia@gmail.com"),
  MAIL_FROM: z.string().default("Zimcamsec Hub <no-reply@zimcamsec.co.zw>"),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_EMAIL: z.string().email().toLowerCase().optional(),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters").optional(),
  // Demo content is on by default only outside production.
  SEED_DEMO_CONTENT: bool(!isProd),
  TRUST_PROXY: bool(false),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
