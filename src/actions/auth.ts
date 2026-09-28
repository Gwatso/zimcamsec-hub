"use server";

import { redirect } from "next/navigation";
import { type FormState, echoValues } from "@/lib/form-state";
import { safeNextPath } from "@/lib/safe-redirect";
import { fieldErrors, registerSchema, signInSchema } from "@/lib/validation";
import { createSession, destroySession, getCurrentUser, revokeAllSessions } from "@/server/auth/session";
import { captureServerError } from "@/server/logger";
import { limits } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { DuplicateAccountError, authenticate, registerUser } from "@/server/services/users";

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  const byIp = limits.signIn().check(ip);
  const byEmail = limits.signInPerEmail().check(parsed.data.email);
  if (!byIp.ok || !byEmail.ok) {
    const wait = minutes(Math.max(byIp.retryAfterMs, byEmail.retryAfterMs));
    return { status: "error", message: `Too many sign-in attempts. Please wait ${wait} minute(s) and try again.`, values };
  }

  let result;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password);
  } catch (error) {
    await captureServerError(error, { action: "signIn" });
    return { status: "error", message: "We couldn't sign you in right now. Please try again shortly.", values };
  }

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "suspended"
          ? "This account has been suspended. Contact support if you think this is a mistake."
          : "Incorrect e-mail or password.",
      values,
    };
  }

  limits.signInPerEmail().reset(parsed.data.email);
  await createSession(result.userId);
  redirect(safeNextPath(formData.get("next"), "/account"));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData);
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error), values };
  }

  const limit = limits.register().check(await clientIp());
  if (!limit.ok) {
    return { status: "error", message: "Too many accounts created from this connection. Please try again later.", values };
  }

  let userId: string;
  try {
    ({ id: userId } = await registerUser(parsed.data));
  } catch (error) {
    if (error instanceof DuplicateAccountError) {
      return {
        status: "error",
        errors: { [error.field]: error.message + (error.field === "email" ? " Try signing in instead." : " Contact support if this is wrong.") },
        values,
      };
    }
    await captureServerError(error, { action: "register" });
    return { status: "error", message: "We couldn't create your account right now. Please try again shortly.", values };
  }

  await createSession(userId);
  redirect(safeNextPath(formData.get("next"), "/account?welcome=1"));
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await revokeAllSessions(user.id);
  await destroySession();
  redirect("/auth/sign-in?signedOut=all");
}
