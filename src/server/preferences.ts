import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DATA_SAVER_COOKIE, THEME_COOKIE } from "@/lib/cookies";

export type Theme = "light" | "dark" | "system";

export interface Preferences {
  dataSaver: boolean;
  theme: Theme;
}

/**
 * Preferences are cookies (not localStorage) so the server can render the
 * right HTML on the first byte: no thumbnails in Data-Saver mode, no dark-mode
 * flash. With no explicit choice, the browser's `Save-Data: on` hint (set by
 * Chrome's Lite mode / Android data saver) turns Data-Saver on automatically.
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const ds = jar.get(DATA_SAVER_COOKIE)?.value;
  const dataSaver = ds === "1" ? true : ds === "0" ? false : h.get("save-data")?.toLowerCase() === "on";
  const t = jar.get(THEME_COOKIE)?.value;
  const theme: Theme = t === "light" || t === "dark" ? t : "system";
  return { dataSaver, theme };
});
