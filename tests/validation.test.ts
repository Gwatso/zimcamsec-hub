import { describe, expect, it } from "vitest";
import { harareDate } from "@/lib/dates";
import { catalogueQuerySchema, normalizeEcNumber, registerSchema, supportSchema } from "@/lib/validation";

function dobForAge(age: number): string {
  const [y, m, d] = harareDate().split("-").map(Number) as [number, number, number];
  // Birthday one day in the past this year → exactly `age` years old.
  const date = new Date(Date.UTC(y - age, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
}

const base = {
  firstName: "Tariro",
  surname: "Moyo",
  email: "tariro@example.com",
  password: "Str0ng-pass-phrase",
  confirmPassword: "Str0ng-pass-phrase",
  acceptTerms: "on",
};

describe("registerSchema — learners (17 and under)", () => {
  it("accepts a 15-year-old", () => {
    const r = registerSchema.safeParse({ ...base, role: "learner", dateOfBirth: dobForAge(15), gradeLevel: "form-3" });
    expect(r.success).toBe(true);
  });

  it("rejects learners over 17", () => {
    const r = registerSchema.safeParse({ ...base, role: "learner", dateOfBirth: dobForAge(18), gradeLevel: "form-6" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["dateOfBirth"]);
  });

  it("requires a guardian e-mail under 13, distinct from the learner's", () => {
    const missing = registerSchema.safeParse({ ...base, role: "learner", dateOfBirth: dobForAge(10), gradeLevel: "grade-5" });
    expect(missing.error?.issues.map((i) => i.path[0])).toContain("guardianEmail");

    const same = registerSchema.safeParse({
      ...base,
      role: "learner",
      dateOfBirth: dobForAge(10),
      gradeLevel: "grade-5",
      guardianEmail: base.email,
    });
    expect(same.success).toBe(false);

    const ok = registerSchema.safeParse({
      ...base,
      role: "learner",
      dateOfBirth: dobForAge(10),
      gradeLevel: "grade-5",
      guardianEmail: "parent@example.com",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects unknown grade levels and impossible dates", () => {
    expect(registerSchema.safeParse({ ...base, role: "learner", dateOfBirth: dobForAge(15), gradeLevel: "form-9" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "learner", dateOfBirth: "2011-02-30", gradeLevel: "form-1" }).success).toBe(false);
  });
});

describe("registerSchema — teachers", () => {
  it("normalises and validates EC numbers", () => {
    expect(normalizeEcNumber(" 1234567-a ")).toBe("1234567A");
    const r = registerSchema.safeParse({ ...base, role: "teacher", ecNumber: "1234567 a", schoolName: "Prince Edward School" });
    expect(r.success && r.data.role === "teacher" && r.data.ecNumber).toBe("1234567A");
  });

  it("rejects malformed EC numbers and missing school", () => {
    expect(registerSchema.safeParse({ ...base, role: "teacher", ecNumber: "ABC", schoolName: "X School" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "teacher", ecNumber: "1234567A", schoolName: "" }).success).toBe(false);
  });

  it("checks password confirmation and terms", () => {
    const r = registerSchema.safeParse({ ...base, confirmPassword: "different", acceptTerms: undefined, role: "teacher", ecNumber: "1234567A", schoolName: "Mabvuku High" });
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain("acceptTerms");
  });
});

describe("supportSchema", () => {
  const ticket = {
    firstName: "Chipo",
    surname: "Ndlovu",
    email: "Chipo@Example.com",
    category: "downloads",
    message: "The Grade 7 maths paper will not open on my phone.",
    website: "",
  };

  it("accepts a valid ticket and lowercases e-mail", () => {
    const r = supportSchema.safeParse(ticket);
    expect(r.success && r.data.email).toBe("chipo@example.com");
  });

  it("treats phone as optional but validates it when present", () => {
    expect(supportSchema.safeParse({ ...ticket, phone: "" }).success).toBe(true);
    const r = supportSchema.safeParse({ ...ticket, phone: "+263 77 123 4567" });
    expect(r.success && r.data.phone).toBe("+263771234567");
    expect(supportSchema.safeParse({ ...ticket, phone: "call me" }).success).toBe(false);
  });

  it("trips the honeypot", () => {
    expect(supportSchema.safeParse({ ...ticket, website: "http://spam" }).success).toBe(false);
  });
});

describe("catalogueQuerySchema", () => {
  it("never throws on garbage and falls back to defaults", () => {
    const q = catalogueQuerySchema.parse({ tier: "nope", page: "-3", year: "abc", type: "x", view: "table" });
    expect(q).toMatchObject({ tier: undefined, page: 1, year: undefined, type: undefined, view: "grid", sort: "popular" });
  });

  it("drops level/subject that don't belong to the tier", () => {
    const q = catalogueQuerySchema.parse({ tier: "junior", level: "form-4", subject: "mathematics" });
    expect(q.level).toBeUndefined();
    expect(q.subject).toBe("mathematics");
  });

  it("defaults to relevance sort only when searching", () => {
    expect(catalogueQuerySchema.parse({ q: "maths" }).sort).toBe("relevance");
    expect(catalogueQuerySchema.parse({ sort: "relevance" }).sort).toBe("popular");
  });
});
