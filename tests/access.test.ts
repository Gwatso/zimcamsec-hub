import { describe, expect, it } from "vitest";
import {
  GUEST_DAILY_DOWNLOADS,
  GUEST_PREVIEW_PAGES,
  guestDownloadDecision,
  isVerifiedEducator,
  resolveAccess,
} from "@/lib/access";

const learner = { role: "learner" as const, teacherStatus: null };
const pendingTeacher = { role: "teacher" as const, teacherStatus: "pending" as const };
const verifiedTeacher = { role: "teacher" as const, teacherStatus: "verified" as const };
const admin = { role: "admin" as const, teacherStatus: null };

describe("resolveAccess — public resources", () => {
  it("lets guests preview only the first pages and download within the daily allowance", () => {
    const a = resolveAccess(null, "public");
    expect(a).toMatchObject({ canPreview: true, previewPages: GUEST_PREVIEW_PAGES, canViewFull: false, canDownload: true, downloadLimited: true });
    expect(a.reason).toBe("sign_in_required");
    expect(GUEST_PREVIEW_PAGES).toBe(2);
  });

  it("gives any signed-in user full, unlimited access", () => {
    for (const viewer of [learner, pendingTeacher, verifiedTeacher, admin]) {
      expect(resolveAccess(viewer, "public")).toMatchObject({
        previewPages: null,
        canViewFull: true,
        canDownload: true,
        downloadLimited: false,
        reason: "ok",
      });
    }
  });
});

describe("resolveAccess — educator-only resources", () => {
  it("never previews to guests", () => {
    expect(resolveAccess(null, "educator")).toMatchObject({ canPreview: false, canDownload: false, reason: "sign_in_required" });
  });

  it("blocks learners and unverified teachers", () => {
    expect(resolveAccess(learner, "educator")).toMatchObject({ canPreview: false, canDownload: false, reason: "educator_only" });
    expect(resolveAccess(pendingTeacher, "educator").canViewFull).toBe(false);
    expect(resolveAccess({ role: "teacher", teacherStatus: "rejected" }, "educator").canViewFull).toBe(false);
  });

  it("allows verified teachers and admins", () => {
    expect(resolveAccess(verifiedTeacher, "educator")).toMatchObject({ canViewFull: true, canDownload: true, previewPages: null });
    expect(resolveAccess(admin, "educator").canDownload).toBe(true);
  });
});

describe("guestDownloadDecision", () => {
  it("allows one new file per day", () => {
    expect(GUEST_DAILY_DOWNLOADS).toBe(1);
    expect(guestDownloadDecision([], "a")).toEqual({ allowed: true, isNew: true, remaining: 0 });
    expect(guestDownloadDecision(["a"], "b")).toEqual({ allowed: false, isNew: false, remaining: 0 });
  });

  it("lets the same file be downloaded again without using the allowance", () => {
    expect(guestDownloadDecision(["a"], "a")).toEqual({ allowed: true, isNew: false, remaining: 0 });
  });

  it("respects a larger limit", () => {
    expect(guestDownloadDecision(["a"], "b", 3)).toEqual({ allowed: true, isNew: true, remaining: 1 });
    expect(guestDownloadDecision(["a", "b", "c"], "d", 3).allowed).toBe(false);
  });
});

describe("isVerifiedEducator", () => {
  it("is true only for verified teachers and admins", () => {
    expect(isVerifiedEducator(null)).toBe(false);
    expect(isVerifiedEducator(learner)).toBe(false);
    expect(isVerifiedEducator(pendingTeacher)).toBe(false);
    expect(isVerifiedEducator(verifiedTeacher)).toBe(true);
    expect(isVerifiedEducator(admin)).toBe(true);
  });
});
