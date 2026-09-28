import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

export function signInPath(next: string): string {
  return `/auth/sign-in?next=${encodeURIComponent(next)}`;
}

/** Use in pages and Server Actions that require any signed-in user. */
export async function requireUser(next = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(next));
  return user;
}

/**
 * Master Admin guard. Call it in every admin page AND every admin Server
 * Action — layouts alone don't protect actions, which are public endpoints.
 * Non-admins get a 404 so the admin area isn't advertised.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") notFound();
  return user;
}
