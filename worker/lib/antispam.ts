/**
 * REMEDIATION-PLAN.md PR3 / BUILD-PLAN.md §9 ("every page renders correctly with JS disabled"):
 * Turnstile's widget requires JavaScript, so it can never be the sole gate on these two forms.
 * This is the JS-free baseline that's sufficient on its own — honeypot + submission-timing, both
 * verified server-side. worker/lib/turnstile.ts layers on top of this when a token is present;
 * it never replaces it.
 *
 * The two field/cookie names live in src/lib/form-antispam.ts, not here, so the Astro pages that
 * render the honeypot field can import just the names without pulling Worker-only code into the
 * static site build.
 */
import { HONEYPOT_FIELD_NAME, TIMING_COOKIE_NAME } from "../../src/lib/form-antispam";

export { HONEYPOT_FIELD_NAME, TIMING_COOKIE_NAME };

/** A human filling the form in a browser can't submit faster than this; a script that POSTs
 *  immediately after GETting the page can. Deliberately conservative (real users pause to read
 *  labels, even on a fast connection) without being so long it penalises someone who tabs
 *  straight through with a password manager. */
const MIN_SUBMIT_MS = 2500;

/** Cookie Max-Age (BUILD-PLAN.md §9 doesn't bound this; picked so a visitor who reads the page,
 *  gets distracted, and comes back within the same sitting can still submit). */
export const TIMING_COOKIE_MAX_AGE_SECONDS = 30 * 60;

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/** True (pass) when the honeypot field is present and empty — real visitors never see or fill
 *  it (see src/lib/form-antispam.ts). Missing entirely also passes: some strict privacy tooling
 *  strips unknown/hidden fields, and the timing check below still applies regardless. */
export function passesHoneypot(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD_NAME);
  return value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * True (pass) when either no timing cookie is present (can't verify — some visitors block
 * cookies entirely; the honeypot check still applies, so this doesn't hand out a free bypass on
 * its own) or the cookie's timestamp is far enough in the past. False only when the cookie is
 * present *and* clearly too recent — the one case this check can be confident is a bot.
 *
 * Deliberately unsigned: a bot sophisticated enough to fetch the GET page, read `Set-Cookie`,
 * and re-POST a forged earlier timestamp would likely also clear the honeypot correctly, at
 * which point this baseline (by design — see REMEDIATION-PLAN.md PR3) isn't meant to stop it;
 * Turnstile is the stronger layer for that once D1 lands. Signing the cookie would close this
 * gap but adds a secret dependency this baseline is explicitly meant not to need.
 */
export function passesTiming(request: Request): boolean {
  const raw = getCookie(request, TIMING_COOKIE_NAME);
  if (!raw) return true;
  const issuedAt = Number(raw);
  if (!Number.isFinite(issuedAt)) return true;
  return Date.now() - issuedAt >= MIN_SUBMIT_MS;
}

/** Set on GET responses for the two form pages (worker/index.ts) — read back by the two POST
 *  handlers via passesTiming(). `Secure` is added only when the request came in over HTTPS, so
 *  the cookie still round-trips during local `wrangler dev` (plain HTTP by default); the real
 *  deploy is always HTTPS (custom_domain in wrangler.toml). */
export function withTimingCookie(response: Response, request: Request): Response {
  const isHttps = new URL(request.url).protocol === "https:";
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${TIMING_COOKIE_NAME}=${Date.now()}; Path=/; Max-Age=${TIMING_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; HttpOnly${isHttps ? "; Secure" : ""}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
