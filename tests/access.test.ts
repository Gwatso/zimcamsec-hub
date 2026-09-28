import { describe, expect, it } from "vitest";
import { GUEST_PREVIEW_PAGES, isVerifiedEducator, resolveAccess } from "@/lib/access";

const learner = { role: "learner" as const, teacherStatus: null };
const pendingTeacher = { role: "teacher" as const, teacherStatus: "pending" as const };
const verifiedTeacher = { role: "teacher" as const, teacherStatus: "verified" as const };
const admin = { role: "admin" as const, teacherStatus: null };

describe("resolveAccess — public resources", () => {
  it("lets guests preview only the first pages", () => {
    const a = resolveAccess(null, "public");
    expect(a).toMatchObject({ canPreview: true, previewPages: GUEST_PREVIEW_PAGES, canViewFull: false, canDownload: false });
    expect(a.reason).toBe("sign_in_required");
    expect(GUEST_PREVIEW_PAGES).toBe(2);
  });

  it("gives any signed-in user full access", () => {
    for (const viewer of [learner, pendingTeacher, verifiedTeacher, admin]) {
      expect(resolveAccess(viewer, "public")).toMatchObject({ previewPages: null, canViewFull: true, canDownload: true, reason: "ok" });
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

describe("isVerifiedEducator", () => {
  it("is true only for verified teachers and admins", () => {
    expect(isVerifiedEducator(null)).toBe(false);
    expect(isVerifiedEducator(learner)).toBe(false);
    expect(isVerifiedEducator(pendingTeacher)).toBe(false);
    expect(isVerifiedEducator(verifiedTeacher)).toBe(true);
    expect(isVerifiedEducator(admin)).toBe(true);
  });
});
