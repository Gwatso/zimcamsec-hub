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

export type AccessReason = "ok" | "sign_in_required" | "educator_only";

export interface AccessDecision {
  /** May the in-app viewer show anything at all? */
  canPreview: boolean;
  /** Page cap for the preview; `null` means the whole document. */
  previewPages: number | null;
  /** May the viewer load the complete document? */
  canViewFull: boolean;
  canDownload: boolean;
  reason: AccessReason;
}

export function isVerifiedEducator(viewer: Viewer): boolean {
  if (!viewer) return false;
  return viewer.role === "admin" || (viewer.role === "teacher" && viewer.teacherStatus === "verified");
}

export function resolveAccess(viewer: Viewer, audience: Audience): AccessDecision {
  if (audience === "educator") {
    if (isVerifiedEducator(viewer)) {
      return { canPreview: true, previewPages: null, canViewFull: true, canDownload: true, reason: "ok" };
    }
    // Teacher-only material (schemes of work, marking schemes, admin circulars)
    // is never previewed to learners or anonymous visitors.
    return {
      canPreview: false,
      previewPages: 0,
      canViewFull: false,
      canDownload: false,
      reason: viewer ? "educator_only" : "sign_in_required",
    };
  }

  if (!viewer) {
    return {
      canPreview: true,
      previewPages: GUEST_PREVIEW_PAGES,
      canViewFull: false,
      canDownload: false,
      reason: "sign_in_required",
    };
  }

  return { canPreview: true, previewPages: null, canViewFull: true, canDownload: true, reason: "ok" };
}
