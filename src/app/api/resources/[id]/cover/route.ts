import { z } from "zod";
import { jsonError } from "@/server/http";
import { getResourceById } from "@/server/services/resources";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Cover thumbnails. Content-addressed keys → safe to cache aggressively. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Not found.");
  const resource = await getResourceById(id);
  if (!resource?.coverKey || !resource.isPublished) return jsonError(404, "not_found", "Not found.");

  const storage = getStorage();
  const size = await storage.size(resource.coverKey);
  if (size === null) return jsonError(404, "not_found", "Not found.");
  const ext = resource.coverKey.split(".").pop() ?? "";

  return new Response(storage.stream(resource.coverKey), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
