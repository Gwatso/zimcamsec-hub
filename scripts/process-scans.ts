/**
 * Turns scanned papers collected from WhatsApp into clean, small, searchable PDFs
 * ready to upload, plus a manifest of suggested catalogue details.
 *
 *   npm run scans -- <input-folder> <output-folder> [options]
 *
 * Input layout:
 *   input/paper.pdf            → one paper
 *   input/photo.jpg            → one single-page paper
 *   input/maths-p1-2019/*.jpg  → one paper; the folder's images/PDFs are merged in name order
 *
 * Per paper: images → PDF (phone EXIF rotation honoured) → greyscale + downsample
 * (Ghostscript) → straighten, rotate and OCR (OCRmyPDF/Tesseract) → a footer strip
 * with the site address added *below* each page, so nothing on the original is covered.
 * Writes <name>.pdf, <name>.txt (the PDF's text, OCR'd or original) and manifest.json.
 *
 * Options:
 *   --site <host>    footer address (default: APP_URL's host)
 *   --dpi <n>        image resolution after downsampling (default 200)
 *   --color          keep colour (maps, colour diagrams); default is greyscale
 *   --no-ocr         skip OCR (if OCRmyPDF isn't installed)
 *   --no-stamp       skip the footer
 *   --lang <codes>   Tesseract languages (default "eng"; e.g. "eng+sna")
 *
 * Needs `ocrmypdf` and `gs` on PATH (Linux/WSL: `sudo apt install ocrmypdf`).
 * Override the commands with OCRMYPDF_CMD / GS_CMD (e.g. GS_CMD=gswin64c on Windows).
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { slugify } from "../src/lib/format";
import { suggestScanMetadata, textSimilarity, type ScanMetadata } from "../src/lib/scan-metadata";

const run = promisify(execFile);

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);
const PDF_EXT = ".pdf";
const A4 = { w: 595.28, h: 841.89 };
const FOOTER_HEIGHT = 16;
/** The portal rejects uploads above this (see admin upload validation). */
const UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
/** Fewer OCR characters per page than this usually means a blurred or dark scan. */
const MIN_TEXT_PER_PAGE = 150;
const DUPLICATE_SIMILARITY = 0.6;

interface Options {
  input: string;
  output: string;
  site: string;
  dpi: number;
  color: boolean;
  ocr: boolean;
  stamp: boolean;
  lang: string;
  /** Set when `unpaper` is installed; OCRmyPDF's --clean needs it. */
  clean: boolean;
}

interface ManifestEntry {
  sources: string[];
  output: string;
  pages: number;
  sizeBytes: number;
  originalBytes: number;
  sha256: string;
  textChars: number;
  suggested: ScanMetadata;
  warnings: string[];
  possibleDuplicateOf?: string;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) positional.push(arg);
    else if (["--site", "--dpi", "--lang"].includes(arg)) flags.set(arg, argv[++i] ?? "");
    else flags.set(arg, true);
  }
  if (positional.length !== 2 || flags.has("--help")) {
    console.error("Usage: npm run scans -- <input-folder> <output-folder> [--site host] [--dpi 200] [--color] [--no-ocr] [--no-stamp] [--lang eng]");
    process.exit(positional.length === 2 ? 0 : 1);
  }
  const appHost = (() => {
    try {
      return new URL(process.env.APP_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  const dpi = Number(flags.get("--dpi") ?? 200);
  return {
    input: resolve(positional[0]!),
    output: resolve(positional[1]!),
    site: String(flags.get("--site") ?? (appHost || "zimcamsec.co.zw")),
    dpi: Number.isFinite(dpi) && dpi >= 72 && dpi <= 600 ? dpi : 200,
    color: flags.has("--color"),
    ocr: !flags.has("--no-ocr"),
    stamp: !flags.has("--no-stamp"),
    lang: String(flags.get("--lang") ?? "eng"),
    clean: false,
  };
}

/** Each loose file is one paper; each sub-folder is one paper made of its files in name order. */
async function findPapers(input: string): Promise<{ name: string; files: string[] }[]> {
  const entries = (await readdir(input, { withFileTypes: true })).sort((a, b) => naturalCompare(a.name, b.name));
  const papers: { name: string; files: string[] }[] = [];
  for (const entry of entries) {
    const path = join(input, entry.name);
    if (entry.isDirectory()) {
      const files = (await readdir(path))
        .filter(isSupported)
        .sort(naturalCompare)
        .map((f) => join(path, f));
      if (files.length > 0) papers.push({ name: entry.name, files });
    } else if (isSupported(entry.name)) {
      papers.push({ name: basename(entry.name, extname(entry.name)), files: [path] });
    } else if (!entry.name.startsWith(".")) {
      console.warn(`  skipped ${entry.name} (only PDF, JPG and PNG are supported)`);
    }
  }
  return papers;
}

function isSupported(name: string): boolean {
  const ext = extname(name).toLowerCase();
  return ext === PDF_EXT || IMAGE_EXT.has(ext);
}

/** "page2" before "page10". */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Merges images and PDFs into one PDF; each image fills an A4 page in its own orientation. */
async function assemble(files: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bytes = await readFile(file);
    const ext = extname(file).toLowerCase();
    if (ext === PDF_EXT) {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await doc.copyPages(src, src.getPageIndices());
      for (const p of pages) doc.addPage(p);
      continue;
    }
    const image = ext === ".png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const rotation = ext === ".png" ? 0 : jpegRotation(bytes);
    // Dimensions as the photo should be seen, after applying the EXIF rotation.
    const [w, h] = rotation % 180 === 0 ? [image.width, image.height] : [image.height, image.width];
    const page = w > h ? doc.addPage([A4.h, A4.w]) : doc.addPage([A4.w, A4.h]);
    const scale = Math.min(page.getWidth() / w, page.getHeight() / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = (page.getWidth() - dw) / 2;
    const y = (page.getHeight() - dh) / 2;
    // drawImage rotates counter-clockwise about the image's bottom-left corner, so
    // offset the origin to keep the rotated photo inside the target box.
    const [iw, ih] = rotation % 180 === 0 ? [dw, dh] : [dh, dw];
    const origin =
      rotation === 90 ? { x: x, y: y + dh } : rotation === 180 ? { x: x + dw, y: y + dh } : rotation === 270 ? { x: x + dw, y } : { x, y };
    page.drawImage(image, { x: origin.x, y: origin.y, width: iw, height: ih, rotate: degrees(-rotation) });
  }
  return doc.save();
}

/**
 * Clockwise rotation (0/90/180/270) a viewer applies to a JPEG from its EXIF
 * Orientation tag. Phones store photos sideways and rely on this tag.
 */
export function jpegRotation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 0;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return 0;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 0;
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 0;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value === 3 ? 180 : value === 6 ? 90 : value === 8 ? 270 : 0;
        }
      }
      return 0;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 0; // start of image data: no EXIF
    offset += 2 + length;
  }
  return 0;
}

/** Greyscale (unless --color) and downsample oversized phone photos with Ghostscript. */
async function compress(inPath: string, outPath: string, opts: Options): Promise<void> {
  const gs = process.env.GS_CMD ?? "gs";
  const args = [
    "-q",
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.6",
    "-dDownsampleColorImages=true",
    "-dDownsampleGrayImages=true",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    `-dColorImageResolution=${opts.dpi}`,
    `-dGrayImageResolution=${opts.dpi}`,
    "-dColorImageDownsampleThreshold=1.2",
    "-dGrayImageDownsampleThreshold=1.2",
    ...(opts.color ? [] : ["-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray"]),
    `-sOutputFile=${outPath}`,
    inPath,
  ];
  await run(gs, args, { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Straighten, auto-rotate and add an invisible text layer. --skip-text leaves
 * pages that already have real text alone. Lossless optimisation only: lossy
 * JBIG2 can silently swap look-alike characters (a 6 for an 8) on exam papers.
 */
async function ocr(inPath: string, outPath: string, opts: Options): Promise<void> {
  const cmd = process.env.OCRMYPDF_CMD ?? "ocrmypdf";
  const args = [
    "--rotate-pages",
    "--deskew",
    ...(opts.clean ? ["--clean"] : []),
    "--skip-text",
    "--optimize",
    "1",
    "--output-type",
    "pdf",
    "-l",
    opts.lang,
    "--quiet",
    inPath,
    outPath,
  ];
  try {
    await run(cmd, args, { maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    // Exit code 6 (PriorOcrFoundError) can't happen with --skip-text; anything else is a real failure.
    throw new Error(`OCRmyPDF failed: ${stderr.trim().split("\n").slice(-3).join(" ") || String(error)}`);
  }
}

/**
 * Adds a strip along the *visual* bottom of each page carrying the site address;
 * the original content is untouched. OCRmyPDF fixes sideways scans by setting a
 * page's /Rotate, so the edge that looks like the bottom depends on it.
 */
async function stamp(bytes: Uint8Array, site: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = `Downloaded free from ${site} - ZIMSEC & Cambridge past papers`;
  const size = 7.5;
  const textWidth = font.widthOfTextAtSize(text, size);
  const F = FOOTER_HEIGHT;
  const grey = rgb(0.35, 0.35, 0.35);
  const white = rgb(1, 1, 1);

  for (const page of doc.getPages()) {
    const { x, y, width: w, height: h } = page.getMediaBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    // [new media box, strip rectangle, text origin] per display rotation (clockwise).
    const layout =
      rotation === 90
        ? { box: [x, y, w + F, h], strip: [x + w, y, F, h], at: [x + w + F - 5, y + (h - textWidth) / 2] }
        : rotation === 180
          ? { box: [x, y, w, h + F], strip: [x, y + h, w, F], at: [x + (w + textWidth) / 2, y + h + F - 5] }
          : rotation === 270
            ? { box: [x - F, y, w + F, h], strip: [x - F, y, F, h], at: [x - F + 5, y + (h + textWidth) / 2] }
            : { box: [x, y - F, w, h + F], strip: [x, y - F, w, F], at: [x + (w - textWidth) / 2, y - F + 5] };
    const [bx, by, bw, bh] = layout.box as [number, number, number, number];
    const [sx, sy, sw, sh] = layout.strip as [number, number, number, number];
    page.setMediaBox(bx, by, bw, bh);
    page.setCropBox(bx, by, bw, bh);
    page.drawRectangle({ x: sx, y: sy, width: sw, height: sh, color: white });
    // Rotating the text by the page's rotation makes it read upright once displayed.
    page.drawText(text, { x: layout.at[0], y: layout.at[1], size, font, color: grey, rotate: degrees(rotation) });
  }
  return doc.save();
}

async function processPaper(
  paper: { name: string; files: string[] },
  opts: Options,
  work: string,
): Promise<{ entry: ManifestEntry; text: string }> {
  const base = slugify(paper.name) || "paper";
  const warnings: string[] = [];
  let originalBytes = 0;
  for (const f of paper.files) originalBytes += (await stat(f)).size;

  let current = join(work, `${base}-1-assembled.pdf`);
  await writeFile(current, await assemble(paper.files));

  const compressed = join(work, `${base}-2-compressed.pdf`);
  await compress(current, compressed, opts);
  current = compressed;

  if (opts.ocr) {
    const ocrd = join(work, `${base}-3-ocr.pdf`);
    await ocr(current, ocrd, opts);
    current = ocrd;
  }

  let bytes: Uint8Array = await readFile(current);
  // Read before stamping so the footer isn't part of the text used for details and duplicates.
  const text = await extractText(bytes);
  if (opts.stamp) bytes = await stamp(bytes, opts.site);

  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPageCount();
  const suggested = suggestScanMetadata(text);
  const outName = slugify(suggested.missing.length <= 1 ? suggested.title : paper.name) || base;
  const output = await uniquePath(opts.output, outName);
  await writeFile(output, bytes);
  if (text) await writeFile(output.replace(/\.pdf$/, ".txt"), text);

  if (text.length < MIN_TEXT_PER_PAGE * pages) warnings.push("little readable text: the scan may be blurred, dark or handwritten");
  if (bytes.byteLength > UPLOAD_LIMIT_BYTES) warnings.push("larger than the 25 MB upload limit: try --dpi 150");
  if (suggested.missing.length > 0) warnings.push(`check manually: ${suggested.missing.join(", ")}`);

  const entry: ManifestEntry = {
    sources: paper.files.map((f) => basename(f)),
    output: basename(output),
    pages,
    sizeBytes: bytes.byteLength,
    originalBytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    textChars: text.length,
    suggested,
    warnings,
  };
  return { entry, text };
}

/** All text in the PDF: the OCR layer on scanned pages, the real text on born-digital ones. */
async function extractText(bytes: Uint8Array): Promise<string> {
  // pdf.js takes ownership of the buffer and rejects Node Buffers, so pass a plain copy.
  const pdf = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
          .join("")
          .replace(/[ \t]+/g, " ")
          .trim(),
      );
    }
    return pages.join("\n\n").trim();
  } finally {
    await pdf.destroy();
  }
}

async function uniquePath(dir: string, name: string): Promise<string> {
  let candidate = join(dir, `${name}.pdf`);
  for (let i = 2; existsSync(candidate); i++) candidate = join(dir, `${name}-${i}.pdf`);
  return candidate;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function checkTools(opts: Options): Promise<void> {
  if (opts.ocr) {
    opts.clean = await run("unpaper", ["--version"]).then(
      () => true,
      () => false,
    );
    if (!opts.clean) console.warn("unpaper not found: scans are OCR'd without background clean-up (sudo apt install unpaper).");
  }
  const tools = [{ cmd: process.env.GS_CMD ?? "gs", args: ["--version"], name: "Ghostscript" }];
  if (opts.ocr) tools.push({ cmd: process.env.OCRMYPDF_CMD ?? "ocrmypdf", args: ["--version"], name: "OCRmyPDF" });
  for (const t of tools) {
    try {
      await run(t.cmd, t.args);
    } catch {
      console.error(`${t.name} not found (tried "${t.cmd}"). On Ubuntu/WSL: sudo apt install ocrmypdf tesseract-ocr ghostscript`);
      process.exit(1);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await checkTools(opts);
  await mkdir(opts.output, { recursive: true });
  const papers = await findPapers(opts.input);
  if (papers.length === 0) {
    console.error(`No PDF, JPG or PNG files found in ${opts.input}`);
    process.exit(1);
  }

  const work = await mkdtemp(join(tmpdir(), "zch-scans-"));
  const done: { entry: ManifestEntry; text: string }[] = [];
  const failed: { sources: string[]; error: string }[] = [];
  try {
    for (const [i, paper] of papers.entries()) {
      process.stdout.write(`[${i + 1}/${papers.length}] ${paper.name} ... `);
      try {
        const result = await processPaper(paper, opts, work);
        const { entry, text } = result;
        // Same paper scanned by someone else: different bytes, near-identical text.
        const twin = text ? done.find((d) => d.text && textSimilarity(text, d.text) >= DUPLICATE_SIMILARITY) : undefined;
        if (twin) {
          entry.possibleDuplicateOf = twin.entry.output;
          entry.warnings.push(`possible duplicate of ${twin.entry.output}`);
        }
        done.push(result);
        console.log(`${formatMb(entry.originalBytes)} -> ${formatMb(entry.sizeBytes)}, ${entry.pages} pages -> ${entry.output}`);
        for (const w of entry.warnings) console.log(`      ! ${w}`);
      } catch (error) {
        failed.push({ sources: paper.files.map((f) => basename(f)), error: (error as Error).message });
        console.log(`FAILED: ${(error as Error).message}`);
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    site: opts.site,
    papers: done.map((d) => d.entry),
    failed,
  };
  await writeFile(join(opts.output, "manifest.json"), JSON.stringify(manifest, null, 2));
  const before = done.reduce((s, d) => s + d.entry.originalBytes, 0);
  const after = done.reduce((s, d) => s + d.entry.sizeBytes, 0);
  console.log(`\n${done.length} processed, ${failed.length} failed. ${formatMb(before)} -> ${formatMb(after)}. Manifest: ${join(opts.output, "manifest.json")}`);
  if (failed.length > 0) process.exitCode = 1;
}

// Only run when executed directly (the tests import jpegRotation).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
