/**
 * PDF processing: validation, page counting and guest-preview generation.
 *
 * Guest previews are real, separately stored PDFs containing only the first
 * N pages. Enforcing the 2-page limit on the server means the rest of the
 * document is never sent to anonymous visitors — a client-side "hide pages"
 * guard would be trivially bypassed via DevTools.
 */
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

export class InvalidPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPdfError";
  }
}

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function looksLikePdf(data: Uint8Array): boolean {
  // "%PDF-" may be preceded by a little junk; the spec allows it within the first 1 KB.
  const head = Buffer.from(data.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

export interface AnalysedPdf {
  checksum: string;
  pageCount: number;
  /** First `previewPages` pages, or null when the source can't be split (e.g. encrypted). */
  preview: Uint8Array | null;
}

export async function analysePdf(data: Uint8Array, previewPages: number): Promise<AnalysedPdf> {
  if (!looksLikePdf(data)) throw new InvalidPdfError("The file is not a PDF document.");

  let source: PDFDocument;
  let pageCount: number;
  try {
    source = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    // pdf-lib parses leniently: a truncated file can "load" and only fail when the page tree is walked.
    pageCount = source.getPageCount();
  } catch {
    throw new InvalidPdfError("The PDF appears to be damaged and could not be opened.");
  }
  if (pageCount < 1) throw new InvalidPdfError("The PDF has no pages.");

  let preview: Uint8Array | null = null;
  if (!source.isEncrypted) {
    try {
      const out = await PDFDocument.create();
      const indices = Array.from({ length: Math.min(previewPages, pageCount) }, (_, i) => i);
      const pages = await out.copyPages(source, indices);
      pages.forEach((p) => out.addPage(p));
      out.setTitle(`${source.getTitle() ?? "Preview"} (preview)`);
      preview = await out.save({ useObjectStreams: true });
    } catch {
      preview = null; // Viewer will explain that a preview is unavailable.
    }
  }

  return { checksum: sha256(data), pageCount, preview };
}
