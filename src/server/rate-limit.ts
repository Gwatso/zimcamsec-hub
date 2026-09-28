/**
 * Fixed-window in-memory rate limiter.
 *
 * Good enough for a single instance. When scaling horizontally, back this
 * interface with Redis/Upstash (INCR + EXPIRE) — callers won't change.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  reset(key: string): void;
}

export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs, maxKeys = 10_000 } = options;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function evict(now: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Still too big (e.g. under attack from many IPs): drop oldest insertions.
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key, now = Date.now()) {
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys) evict(now);
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const ok = bucket.count <= limit;
      return { ok, remaining: Math.max(0, limit - bucket.count), retryAfterMs: ok ? 0 : bucket.resetAt - now };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

const globalForLimits = globalThis as unknown as { __zchLimiters?: Map<string, RateLimiter> };

/** Named limiters shared across hot reloads. */
export function limiter(name: string, options: { limit: number; windowMs: number }): RateLimiter {
  globalForLimits.__zchLimiters ??= new Map();
  let instance = globalForLimits.__zchLimiters.get(name);
  if (!instance) {
    instance = createRateLimiter(options);
    globalForLimits.__zchLimiters.set(name, instance);
  }
  return instance;
}

export const limits = {
  signIn: () => limiter("sign-in", { limit: 10, windowMs: 15 * 60_000 }),
  signInPerEmail: () => limiter("sign-in-email", { limit: 5, windowMs: 15 * 60_000 }),
  register: () => limiter("register", { limit: 5, windowMs: 60 * 60_000 }),
  support: () => limiter("support", { limit: 5, windowMs: 60 * 60_000 }),
  telemetry: () => limiter("telemetry", { limit: 30, windowMs: 60_000 }),
  files: () => limiter("files", { limit: 300, windowMs: 60_000 }),
};
