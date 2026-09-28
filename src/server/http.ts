import type { ByteRange } from "./storage";

/**
 * Parses a single-range `Range: bytes=…` header.
 * Returns null when absent/unsupported (serve the whole file), or "invalid"
 * when unsatisfiable (respond 416). Multi-range requests fall back to a full
 * response, which is allowed by RFC 9110.
 */
export function parseRange(header: string | null, size: number): ByteRange | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startStr = "", endStr = ""] = match;
  if (startStr === "" && endStr === "") return "invalid";

  let start: number;
  let end: number;
  if (startStr === "") {
    // Suffix range: last N bytes.
    const suffix = Number(endStr);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? size - 1 : Math.min(Number(endStr), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return "invalid";
  return { start, end };
}

export function jsonError(status: number, error: string, message: string, headers: HeadersInit = {}) {
  return Response.json({ error, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** RFC 6266 filename with an ASCII fallback. */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
