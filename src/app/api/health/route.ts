import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for load balancers / uptime monitors. */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return Response.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
