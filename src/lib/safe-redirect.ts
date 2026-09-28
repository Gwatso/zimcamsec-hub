/**
 * Validates a post-login `next` parameter to prevent open redirects:
 * only same-origin absolute paths are allowed ("/x", never "//evil.com" or
 * "/\\evil.com", which some browsers treat as protocol-relative).
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  if (value.startsWith("/auth/")) return fallback;
  return value;
}
