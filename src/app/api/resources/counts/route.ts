import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/server/http";
import { captureServerError } from "@/server/logger";
import { getDownloadCounts } from "@/server/services/resources";

export const dynamic = "force-dynamic";

const idsSchema = z.array(z.string().uuid()).min(1).max(50);

/**
 * Batched live counters for the badges on screen. Counts are public and
 * identical for everyone, so a short shared cache lets a CDN absorb polling.
 * `fresh=1` (sent right after the user's own download) bypasses caches.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  const parsed = idsSchema.safeParse([...new Set(raw.split(",").filter(Boolean))]);
  if (!parsed.success) return jsonError(400, "bad_request", "Provide 1–50 resource ids.");

  try {
    const counts = await getDownloadCounts(parsed.data);
    const fresh = request.nextUrl.searchParams.get("fresh") === "1";
    return Response.json(
      { counts },
      {
        headers: {
          "Cache-Control": fresh ? "no-store" : "public, max-age=10, s-maxage=20, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    await captureServerError(error, { route: "resource-counts" });
    return jsonError(500, "server_error", "Counts are temporarily unavailable.");
  }
}
