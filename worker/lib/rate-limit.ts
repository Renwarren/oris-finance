/**
 * REMEDIATION-PLAN.md PR3: "Rate-limit submissions by IP (in-memory/KV-based is fine for a first
 * pass — note your approach in the PR)." This is the in-memory first pass.
 *
 * Fixed window, keyed by `CF-Connecting-IP`, module-scope `Map`. Known limitations, deliberately
 * accepted for a first pass rather than reached for a KV/Durable Object counter:
 *  - Per-isolate: a busy route runs on many isolates across Cloudflare's edge, each with its own
 *    counter, so the *effective* global limit is higher than MAX_REQUESTS_PER_WINDOW suggests.
 *  - Not durable: an isolate eviction (Cloudflare recycles idle isolates) resets that isolate's
 *    counters to zero.
 * Good enough to blunt a naive scripted flood against a single isolate; not a hard guarantee.
 * Upgrade path if abuse shows up in practice: a Workers KV counter (accepts the limitation above
 * being merely small instead of large) or a Durable Object (exact, but adds an object per IP or
 * a sharding scheme — more than a first pass warrants).
 *
 * This is module-scope mutable state, which workers-best-practices normally flags — but the
 * anti-pattern it's warning about is *request-scoped* data leaking across requests (e.g. caching
 * one visitor's session in a variable another request then reads). An aggregate per-IP counter
 * that many requests are *meant* to share is the intended use of isolate-lifetime state; the
 * limitation above is about durability, not correctness.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

/** Crude ceiling so a burst of unique IPs (or an IP-spoofing flood — CF-Connecting-IP is set by
 *  Cloudflare's edge, not the client, so this mainly guards against a very large number of
 *  distinct real visitors) can't grow this map without bound for the isolate's lifetime. */
const MAX_TRACKED_IPS = 10_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requestCounts = new Map<string, RateLimitEntry>();

/** Returns true when `ip` has exceeded the window's request budget and the caller should reject. */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    if (requestCounts.size >= MAX_TRACKED_IPS) requestCounts.clear();
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

export function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}
