"use server";

import { cookies } from "next/headers";
import { DATA_SAVER_COOKIE, THEME_COOKIE } from "@/lib/cookies";
import { getPreferences } from "@/server/preferences";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Toggles Data-Saver. Works as a plain <form> POST, so it also works without JavaScript. */
export async function toggleDataSaverAction(): Promise<void> {
  const { dataSaver } = await getPreferences();
  (await cookies()).set(DATA_SAVER_COOKIE, dataSaver ? "0" : "1", {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function setThemeAction(theme: unknown): Promise<void> {
  // Server Action arguments are untrusted client input.
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;
  const jar = await cookies();
  if (theme === "system") jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}
