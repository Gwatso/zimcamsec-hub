import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAccess } from "@/lib/access";
import { GUEST_COOKIE, GUEST_TTL_SECONDS } from "@/lib/cookies";
import { getCurrentUser } from "@/server/auth/session";
import { contentDisposition, jsonError, parseRange } from "@/server/http";
import { captureServerError, log } from "@/server/logger";
import { limits } from "@/server/rate-limit";
import { clientIpFrom } from "@/server/request";
import { recordResourceAccess } from "@/server/services/downloads";
import { claimGuestDownload, newGuestId, parseGuestId } from "@/server/services/guest-downloads";
import { getResourceById } from "@/server/services/resources";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

const modeSchema = z.enum(["preview", "view", "download"]).catch("view");

/**
 * Single choke-point for document bytes. Enforces:
 *  - guest preview guardrail (server-truncated 2-page PDF),
 *  - educator-only content,
 *  - sign-in for the full in-app view,
 *  - the guest daily download allowance (signed-in users are unlimited),
 * and supports HTTP Range so pdf.js fetches only the pages being read and
 * interrupted downloads on flaky connections can resume.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Resource not found.");

  const ip = clientIpFrom(request.headers);
  const rate = limits.files().check(ip);
  if (!rate.ok) {
    return jsonError(429, "rate_limited", "Too many requests. Please slow down.", {
      "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)),
    });
  }

  const mode = modeSchema.parse(request.nextUrl.searchParams.get("mode"));

  try {
    const [resource, user] = await Promise.all([getResourceById(id), getCurrentUser()]);
    if (!resource || (!resource.isPublished && user?.role !== "admin")) {
      return jsonError(404, "not_found", "Resource not found.");
    }

    const access = resolveAccess(user ? { role: user.role, teacherStatus: user.teacherStatus } : null, resource.audience);

    let key: string;
    let etag: string;
    /** Set when an anonymous visitor downloads; `isNew` means the cookie must be issued. */
    let guest: { id: string; isNew: boolean } | null = null;
    if (mode === "preview" && access.previewPages !== null) {
      if (!access.canPreview) return jsonError(403, access.reason, "This resource is available to verified educators only.");
      if (!resource.previewKey) return jsonError(404, "preview_unavailable", "A preview isn't available for this document.");
      key = resource.previewKey;
      etag = `"${resource.checksumSha256}-preview"`;
    } else if (!user && mode === "download" && access.canDownload && access.downloadLimited) {
      const existing = parseGuestId(request.cookies.get(GUEST_COOKIE)?.value);
      guest = existing ? { id: existing, isNew: false } : { id: newGuestId(), isNew: true };
      key = resource.fileKey;
      etag = `"${resource.checksumSha256}"`;
    } else {
      if (!user) return jsonError(401, "sign_in_required", "Please sign in to open the full document.");
      if (!access.canViewFull) return jsonError(403, access.reason, "This resource is available to verified educators only.");
      key = resource.fileKey;
      etag = `"${resource.checksumSha256}"`;
    }

    const isPreview = key === resource.previewKey;
    const cacheControl = isPreview && resource.audience === "public" ? "public, max-age=3600" : "private, no-cache";

    const storage = getStorage();
    const size = await storage.size(key);
    if (size === null) {
      log("error", "resource blob missing", { resourceId: resource.id, key });
      return jsonError(404, "file_missing", "This file is temporarily unavailable. Our team has been notified.");
    }

    // Claimed on every guest request (not only byte 0) so a Range request can't fetch a new file for free;
    // after the blob check so a missing file never uses up the allowance.
    if (guest) {
      const claim = await claimGuestDownload({ guestId: guest.id, resourceId: resource.id });
      if (!claim.allowed) {
        // The download link is a plain navigation: send people back to the page, which explains the limit.
        if (request.headers.get("accept")?.includes("text/html")) {
          return Response.redirect(new URL(`/resources/${resource.slug}`, request.nextUrl), 303);
        }
        return jsonError(403, "guest_limit_reached", "You've used today's free download. Sign in or create a free account for unlimited downloads.");
      }
    }

    if (request.headers.get("if-none-match") === etag) {
      const headers = new Headers({ ETag: etag, "Cache-Control": cacheControl });
      if (guest?.isNew) headers.append("Set-Cookie", guestCookie(guest.id));
      return new Response(null, { status: 304, headers });
    }

    const range = parseRange(request.headers.get("range"), size);
    if (range === "invalid") {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }

    // Count once per logical open: pdf.js follow-up range requests (start > 0) are not new views.
    if (user && !isPreview && (!range || range.start === 0)) {
      await recordResourceAccess({ resourceId: resource.id, userId: user.id, kind: mode === "download" ? "download" : "view" }).catch(
        (error: unknown) => captureServerError(error, { where: "recordResourceAccess", resourceId: resource.id }),
      );
    }

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
      ETag: etag,
      "Content-Disposition": contentDisposition(mode === "download" ? "attachment" : "inline", `${resource.slug}.pdf`),
      "X-Robots-Tag": "noindex",
    });
    if (guest?.isNew) headers.append("Set-Cookie", guestCookie(guest.id));

    if (range) {
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("Content-Length", String(range.end - range.start + 1));
      return new Response(storage.stream(key, range), { status: 206, headers });
    }
    headers.set("Content-Length", String(size));
    return new Response(storage.stream(key), { status: 200, headers });
  } catch (error) {
    await captureServerError(error, { route: "resource-file", resourceId: id, mode });
    return jsonError(500, "server_error", "Something went wrong while loading this document.");
  }
}

function guestCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${id}; Path=/; Max-Age=${GUEST_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}
