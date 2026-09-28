import type { Instrumentation } from "next";

/*
 * Node-only imports must sit inside `if (process.env.NEXT_RUNTIME === "nodejs")`
 * blocks: Next inlines the variable at compile time, so the edge build drops
 * them instead of trying to bundle `pg`, `fs`, etc.
 */

/**
 * Runs once per server process. Warms the database (connect + migrate +
 * seed) so the first visitor doesn't pay for it, and surfaces a bad
 * configuration at boot instead of on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { getDbHandle } = await import("./server/db/client");
    try {
      const handle = await getDbHandle();
      console.info(`[startup] database ready (${handle.kind})`);
    } catch (error) {
      console.error("[startup] database initialisation failed — requests will retry", error);
    }
  }
}

/** Global server error hook: every unhandled render/route/action error lands in the admin log. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureServerError } = await import("./server/logger");
    await captureServerError(error, {
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
    });
  }
};
