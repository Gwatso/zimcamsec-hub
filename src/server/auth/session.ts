import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Role, TeacherStatus, Viewer } from "@/lib/access";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/cookies";
import { getDb } from "../db/client";
import { sessions, users } from "../db/schema";
import { log } from "../logger";

/**
 * Opaque, DB-backed sessions:
 *  - the cookie holds 32 random bytes; the DB stores only their SHA-256, so a
 *    database leak does not leak usable sessions;
 *  - revocation is instant (suspend user / "sign out everywhere");
 *  - sliding expiry: active users stay signed in, idle sessions die after 30 days.
 */
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const RENEW_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  surname: string;
  role: Role;
  teacherStatus: TeacherStatus | null;
  gradeLevel: string | null;
  dateOfBirth: string | null;
  schoolName: string | null;
  ecNumber: string | null;
  createdAt: Date;
}

export function sessionCookieOptions(maxAgeMs: number = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session and sets the cookie. Only callable from Server Actions / Route Handlers. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  // Opportunistic housekeeping (~2% of sign-ins) instead of a cron job.
  if (Math.random() < 0.02) {
    db.delete(sessions)
      .where(lt(sessions.expiresAt, new Date()))
      .catch((error: unknown) => log("warning", "session purge failed", { error: String(error) }));
  }
}

/** The signed-in user for this request (memoised per request via React cache). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const db = await getDb();
  const id = hashToken(token);
  const now = new Date();
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      surname: users.surname,
      role: users.role,
      teacherStatus: users.teacherStatus,
      gradeLevel: users.gradeLevel,
      dateOfBirth: users.dateOfBirth,
      schoolName: users.schoolName,
      ecNumber: users.ecNumber,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now), eq(users.status, "active")))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt.getTime() - now.getTime() < RENEW_WHEN_REMAINING_MS) {
    db.update(sessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id))
      .catch((error: unknown) => log("warning", "session renewal failed", { error: String(error) }));
  }

  const { expiresAt: _expiresAt, ...user } = row;
  return user;
});

export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser();
  return user ? { role: user.role, teacherStatus: user.teacherStatus } : null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
