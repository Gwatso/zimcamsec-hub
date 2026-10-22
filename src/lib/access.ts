/**
 * Resource access policy — a pure function so the exact same rules drive the
 * server (authoritative enforcement in route handlers) and the UI (which
 * buttons / banners to show). Covered by tests/access.test.ts.
 */
import type { Audience } from "./curriculum";

export type Role = "learner" | "teacher" | "admin";
export type TeacherStatus = "pending" | "verified" | "rejected";

export type Viewer = { role: Role; teacherStatus: TeacherStatus | null } | null;

/** Pages an anonymous visitor may preview before being asked to sign in. */
export const GUEST_PREVIEW_PAGES = 2;

/**
 * Different files an anonymous visitor may download per Harare day. Downloading
 * the same file again (a retry or resume on a flaky connection) is free.
 */
export const GUEST_DAILY_DOWNLOADS = 1;

export type AccessReason = "ok" | "sign_in_required" | "educator_only";

export interface AccessDecision {
  /** May the in-app viewer show anything at all? */
  canPreview: boolean;
  /** Page cap for the preview; `null` means the whole document. */
  previewPages: number | null;
  /** May the viewer load the complete document? */
  canViewFull: boolean;
  canDownload: boolean;
  /** Downloads count against the guest daily allowance (enforced by the file route). */
  downloadLimited: boolean;
  reason: AccessReason;
}

export function isVerifiedEducator(viewer: Viewer): boolean {
  if (!viewer) return false;
  return viewer.role === "admin" || (viewer.role === "teacher" && viewer.teacherStatus === "verified");
}

export function resolveAccess(viewer: Viewer, audience: Audience): AccessDecision {
  if (audience === "educator") {
    if (isVerifiedEducator(viewer)) {
      return { canPreview: true, previewPages: null, canViewFull: true, canDownload: true, downloadLimited: false, reason: "ok" };
    }
    // Teacher-only material (schemes of work, marking schemes, admin circulars)
    // is never previewed to learners or anonymous visitors.
    return {
      canPreview: false,
      previewPages: 0,
      canViewFull: false,
      canDownload: false,
      downloadLimited: false,
      reason: viewer ? "educator_only" : "sign_in_required",
    };
  }

  if (!viewer) {
    return {
      canPreview: true,
      previewPages: GUEST_PREVIEW_PAGES,
      canViewFull: false,
      canDownload: true,
      downloadLimited: true,
      reason: "sign_in_required",
    };
  }

  return { canPreview: true, previewPages: null, canViewFull: true, canDownload: true, downloadLimited: false, reason: "ok" };
}

export interface GuestDownloadDecision {
  allowed: boolean;
  /** True when this download uses up part of today's allowance (and should be counted). */
  isNew: boolean;
  /** Different files still downloadable today after this one. */
  remaining: number;
}

/** Applies the guest allowance to the files this visitor already downloaded today. */
export function guestDownloadDecision(
  downloadedToday: readonly string[],
  resourceId: string,
  limit: number = GUEST_DAILY_DOWNLOADS,
): GuestDownloadDecision {
  const used = new Set(downloadedToday).size;
  if (downloadedToday.includes(resourceId)) return { allowed: true, isNew: false, remaining: Math.max(0, limit - used) };
  if (used < limit) return { allowed: true, isNew: true, remaining: limit - used - 1 };
  return { allowed: false, isNew: false, remaining: 0 };
}
