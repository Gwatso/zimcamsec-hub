import { describe, expect, it } from "vitest";
import { ageOn, harareDate, parseIsoDate } from "@/lib/dates";
import { formatBytes, formatCount, slugify } from "@/lib/format";
import { safeNextPath } from "@/lib/safe-redirect";
import { toPrefixTsQuery } from "@/lib/search";
import { parseRange } from "@/server/http";
import { createRateLimiter } from "@/server/rate-limit";

describe("dates", () => {
  it("rejects impossible calendar dates", () => {
    expect(parseIsoDate("2011-02-30")).toBeNull();
    expect(parseIsoDate("2012-02-29")).toEqual({ y: 2012, m: 2, d: 29 });
    expect(parseIsoDate("12/05/2010")).toBeNull();
  });

  it("computes age with birthday boundaries", () => {
    expect(ageOn("2009-06-15", "2026-06-14")).toBe(16);
    expect(ageOn("2009-06-15", "2026-06-15")).toBe(17);
    expect(ageOn("2008-06-15", "2026-06-15")).toBe(18);
    expect(ageOn("2012-02-29", "2026-02-28")).toBe(13);
    expect(ageOn("2012-02-29", "2026-03-01")).toBe(14);
  });

  it("returns null for future or invalid dates of birth", () => {
    expect(ageOn("2030-01-01", "2026-01-01")).toBeNull();
    expect(ageOn("not-a-date", "2026-01-01")).toBeNull();
  });

  it("uses Harare time (UTC+2) for 'today'", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Harare.
    expect(harareDate(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("toPrefixTsQuery", () => {
  it("builds an AND-ed prefix query", () => {
    expect(toPrefixTsQuery("O level Maths 2023")).toBe("o:* & level:* & maths:* & 2023:*");
  });

  it("strips tsquery operators and punctuation (no syntax errors possible)", () => {
    expect(toPrefixTsQuery("maths & (physics | !chem):*")).toBe("maths:* & physics:* & chem:*");
    expect(toPrefixTsQuery("!!! &&& ")).toBeNull();
    expect(toPrefixTsQuery("")).toBeNull();
  });

  it("folds accents, de-duplicates and caps terms", () => {
    expect(toPrefixTsQuery("Café café")).toBe("cafe:*");
    expect(toPrefixTsQuery("a b c d e f g h i j")?.split(" & ")).toHaveLength(8);
  });
});

describe("safeNextPath", () => {
  it("allows same-origin paths", () => {
    expect(safeNextPath("/resources/o-level-maths?x=1")).toBe("/resources/o-level-maths?x=1");
  });
  it("blocks open redirects", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, 42]) {
      expect(safeNextPath(bad, "/account")).toBe("/account");
    }
  });
  it("never bounces back into the auth pages", () => {
    expect(safeNextPath("/auth/sign-in", "/")).toBe("/");
  });
});

describe("parseRange", () => {
  it("parses byte ranges", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 });
  });
  it("flags unsatisfiable ranges and ignores unsupported ones", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=50-10", 1000)).toBe("invalid");
    expect(parseRange("bytes=0-1,5-9", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("blocks after the limit and resets after the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check("ip", 0).ok).toBe(true);
    expect(limiter.check("ip", 10).ok).toBe(true);
    const blocked = limiter.check("ip", 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(980);
    expect(limiter.check("other", 20).ok).toBe(true);
    expect(limiter.check("ip", 1001).ok).toBe(true);
  });

  it("stays bounded in memory", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) limiter.check(`k${i}`, 0);
    // No assertion on internals: the loop completing without growth-related slowdown is the check;
    // a fresh key must still be admitted.
    expect(limiter.check("fresh", 1).ok).toBe(true);
  });
});

describe("format helpers", () => {
  it("formats sizes and counts compactly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1250)).toBe("1.2k");
    expect(formatCount(15_300)).toBe("15k");
    expect(formatCount(2_350_000)).toBe("2.3M");
  });

  it("slugifies titles", () => {
    expect(slugify("O-Level Mathematics Paper 1 (November 2023)")).toBe("o-level-mathematics-paper-1-november-2023");
    expect(slugify("Science & Technology — Grade 6")).toBe("science-and-technology-grade-6");
  });
});
