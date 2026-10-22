import { describe, expect, it } from "vitest";
import { suggestScanMetadata, textSimilarity } from "@/lib/scan-metadata";
import { jpegRotation } from "../scripts/process-scans";

const O_LEVEL_COVER = `ZIMBABWE SCHOOL EXAMINATIONS COUNCIL
General Certificate of Education Ordinary Level
MATHEMATICS 4004/1
PAPER 1
NOVEMBER 2019 SESSION 2 hours 30 minutes
Candidates answer on the question paper.`;

describe("suggestScanMetadata", () => {
  it("reads a ZIMSEC O-Level cover", () => {
    expect(suggestScanMetadata(O_LEVEL_COVER)).toEqual({
      board: "zimsec",
      tier: "lower-secondary",
      level: "form-4",
      subject: "mathematics",
      resourceType: "past-paper",
      paperNumber: 1,
      examSession: "november",
      year: 2019,
      title: "O-Level Mathematics Paper 1 (November 2019)",
      missing: [],
    });
  });

  it("prefers the longer subject name, reads roman paper numbers and year-first sessions", () => {
    const m = suggestScanMetadata("ZIMSEC  Advanced   Level\nPURE MATHEMATICS 6042\nPAPER II\n2021 June");
    expect(m).toMatchObject({ tier: "upper-secondary", level: "form-6", subject: "pure-mathematics", paperNumber: 2, examSession: "june", year: 2021 });
    expect(m.title).toBe("A-Level Pure Mathematics Paper 2 (June 2021)");
  });

  it("detects marking schemes, subject-code paper numbers and the copyright session code", () => {
    const m = suggestScanMetadata("Ordinary Level Principles of Accounts 7112/2 Marking Scheme ©ZIMSEC J2018");
    expect(m).toMatchObject({ resourceType: "marking-scheme", subject: "principles-of-accounting", paperNumber: 2, examSession: "june", year: 2018 });
    expect(m.title).toBe("O-Level Principles of Accounting Paper 2 Marking Scheme (June 2018)");
  });

  it("reads Grade 7 and specimen papers, which have no exam session", () => {
    const m = suggestScanMetadata("ZIMSEC Grade 7 Specimen Paper 1 English 2024");
    expect(m).toMatchObject({ tier: "junior", level: "grade-7", subject: "english", resourceType: "specimen-paper", year: 2024 });
    expect(m.missing).toEqual([]);
  });

  it("does not call notes a past paper and lists what is missing", () => {
    const m = suggestScanMetadata("Form 3 Geography revision notes: weather and climate");
    expect(m).toMatchObject({ resourceType: null, level: "form-3", subject: "geography" });
    expect(m.missing).toEqual(["type"]);
    expect(m.title).toBe("Form 3 Geography");
  });

  it("ignores subject words that only appear after the cover", () => {
    const m = suggestScanMetadata(`${O_LEVEL_COVER}\n${"x ".repeat(1000)} Biology Chemistry`);
    expect(m.subject).toBe("mathematics");
  });

  it("copes with empty OCR text", () => {
    const m = suggestScanMetadata("");
    expect(m).toMatchObject({ board: null, tier: null, subject: null, resourceType: null });
    expect(m.missing).toEqual(["type", "level", "subject"]);
  });
});

describe("textSimilarity", () => {
  const paper = "1. Express 0.000453 in standard form. 2. Simplify (2x + 3)(x - 4) and collect like terms. 3. A shop sells a radio for $84.";
  it("scores two OCR runs of the same paper high and different papers low", () => {
    const rescan = paper.replace("Simplify", "Simpiify").replace("$84", "S84");
    expect(textSimilarity(paper, rescan)).toBeGreaterThan(0.6);
    expect(textSimilarity(paper, "Weather is the day to day condition of the atmosphere at a place.")).toBe(0);
    expect(textSimilarity("", paper)).toBe(0);
  });
});

describe("jpegRotation", () => {
  function jpegWithOrientation(value: number | null): Uint8Array {
    const soi = [0xff, 0xd8];
    const sos = [0xff, 0xda, 0x00, 0x02];
    if (value === null) return new Uint8Array([...soi, ...sos]);
    const tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, value, 0, 0, 0, 0, 0, 0, 0];
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const len = body.length + 2;
    return new Uint8Array([...soi, 0xff, 0xe1, len >> 8, len & 0xff, ...body, ...sos]);
  }

  it("maps EXIF orientation to a clockwise rotation", () => {
    expect(jpegRotation(jpegWithOrientation(1))).toBe(0);
    expect(jpegRotation(jpegWithOrientation(6))).toBe(90);
    expect(jpegRotation(jpegWithOrientation(3))).toBe(180);
    expect(jpegRotation(jpegWithOrientation(8))).toBe(270);
  });

  it("returns 0 without EXIF or for non-JPEG and truncated data", () => {
    expect(jpegRotation(jpegWithOrientation(null))).toBe(0);
    expect(jpegRotation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(0);
    expect(jpegRotation(jpegWithOrientation(6).slice(0, 14))).toBe(0);
  });
});
