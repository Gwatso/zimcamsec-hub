/**
 * Date helpers. Zimbabwe runs on Central Africa Time (UTC+2, no DST), so
 * "today" — for birthdays and daily download de-duplication — is computed in
 * Africa/Harare regardless of where the server runs.
 */

export const APP_TIME_ZONE = "Africa/Harare";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for `date` in Harare. */
export function harareDate(date: Date = new Date()): string {
  return isoDateFormatter.format(date);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a strict YYYY-MM-DD calendar date, rejecting impossible dates like 2011-02-30. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/**
 * Whole years between `dateOfBirth` (YYYY-MM-DD) and `today` (YYYY-MM-DD, Harare).
 * Returns null for invalid or future dates. A 29 February birthday is treated
 * as reached on 1 March in non-leap years.
 */
export function ageOn(dateOfBirth: string, today: string = harareDate()): number | null {
  const dob = parseIsoDate(dateOfBirth);
  const now = parseIsoDate(today);
  if (!dob || !now) return null;
  if (dateOfBirth > today) return null;
  let age = now.y - dob.y;
  if (now.m < dob.m || (now.m === dob.m && now.d < dob.d)) age -= 1;
  return age;
}

const displayFormatter = new Intl.DateTimeFormat("en-ZW", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const displayTimeFormatter = new Intl.DateTimeFormat("en-ZW", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string): string {
  return displayFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return displayTimeFormatter.format(new Date(value));
}
