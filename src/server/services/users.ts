import "server-only";
import { type SQL, and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { RegisterInput } from "@/lib/validation";
import { getDummyHash, hashPassword, verifyPassword } from "../auth/password";
import { revokeAllSessions } from "../auth/session";
import { getDb } from "../db/client";
import { users } from "../db/schema";

export class DuplicateAccountError extends Error {
  constructor(public readonly field: "email" | "ecNumber") {
    super(field === "email" ? "An account with this e-mail already exists." : "This EC Number is already registered.");
    this.name = "DuplicateAccountError";
  }
}

function isUniqueViolation(error: unknown): error is { code: string; constraint?: string; message: string } {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; cause?: unknown };
  if (e.code === "23505") return true;
  // Drizzle wraps driver errors in `cause` in newer versions.
  return isUniqueViolation(e.cause);
}

function constraintOf(error: unknown): string {
  const e = error as { constraint?: string; message?: string; cause?: unknown };
  return e.constraint ?? e.message ?? (e.cause ? constraintOf(e.cause) : "");
}

export async function registerUser(input: RegisterInput): Promise<{ id: string }> {
  const db = await getDb();
  const passwordHash = await hashPassword(input.password);
  const base = {
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    surname: input.surname,
  };

  const values =
    input.role === "learner"
      ? {
          ...base,
          role: "learner" as const,
          dateOfBirth: input.dateOfBirth,
          gradeLevel: input.gradeLevel,
          guardianEmail: input.guardianEmail ?? null,
        }
      : {
          ...base,
          role: "teacher" as const,
          ecNumber: input.ecNumber,
          schoolName: input.schoolName,
          teacherStatus: "pending" as const,
        };

  try {
    // Rely on the unique constraints (not a pre-check) so concurrent sign-ups can't race.
    const [row] = await db.insert(users).values(values).returning({ id: users.id });
    if (!row) throw new Error("Insert returned no row");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateAccountError(constraintOf(error).includes("ec_number") ? "ecNumber" : "email");
    }
    throw error;
  }
}

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "suspended" };

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always run a hash comparison so timing doesn't reveal whether the e-mail exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) return { ok: false, reason: "invalid" };
  if (user.status === "suspended") return { ok: false, reason: "suspended" };

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, userId: user.id };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const ADMIN_USERS_PAGE_SIZE = 25;

export async function listUsers(filters: { q?: string; role?: string; queue?: boolean; page: number }) {
  const db = await getDb();
  const conditions: SQL[] = [];
  if (filters.role === "learner" || filters.role === "teacher" || filters.role === "admin") {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters.queue) conditions.push(and(eq(users.role, "teacher"), eq(users.teacherStatus, "pending"))!);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(users.email, term),
        ilike(users.firstName, term),
        ilike(users.surname, term),
        ilike(users.ecNumber, term),
        ilike(users.schoolName, term),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ n: count() }).from(users).where(where);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      surname: users.surname,
      role: users.role,
      status: users.status,
      teacherStatus: users.teacherStatus,
      ecNumber: users.ecNumber,
      schoolName: users.schoolName,
      gradeLevel: users.gradeLevel,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(ADMIN_USERS_PAGE_SIZE)
    .offset((Math.max(1, filters.page) - 1) * ADMIN_USERS_PAGE_SIZE);
  return { rows, total: totalRow?.n ?? 0 };
}

export async function setTeacherStatus(userId: string, status: "verified" | "rejected" | "pending") {
  const db = await getDb();
  await db
    .update(users)
    .set({ teacherStatus: status, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, "teacher")));
}

export async function setUserStatus(userId: string, status: "active" | "suspended") {
  const db = await getDb();
  // Admins can't be suspended from the UI (prevents locking everyone out).
  await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(users.id, userId), sql`${users.role} <> 'admin'`));
  if (status === "suspended") await revokeAllSessions(userId);
}

export async function getUserCounts() {
  const db = await getDb();
  const rows = await db.select({ role: users.role, n: count() }).from(users).groupBy(users.role);
  const [pending] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "teacher"), eq(users.teacherStatus, "pending")));
  const byRole = Object.fromEntries(rows.map((r) => [r.role, r.n])) as Record<string, number>;
  return {
    learners: byRole.learner ?? 0,
    teachers: byRole.teacher ?? 0,
    admins: byRole.admin ?? 0,
    pendingTeachers: pending?.n ?? 0,
  };
}
