/**
 * REMEDIATION-PLAN.md PR3: Turnstile is a progressive enhancement on top of the honeypot+timing
 * baseline (worker/lib/antispam.ts), never a hard requirement — see that file's header comment
 * and BUILD-PLAN.md §9. This module only runs when a token is actually present in the submitted
 * form data, which (until D1 answers the site key and the widget is turned on in the two Astro
 * pages) is never.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteverifyResponse {
  success: boolean;
  [key: string]: unknown;
}

/**
 * Verifies a Turnstile token. Returns `true` only on an explicit `success: true` from
 * Cloudflare. A network error or non-2xx response from siteverify itself returns `null` (not
 * `false`) so the caller can fall back to the baseline check instead of hard-rejecting a
 * legitimate submission over a transient Cloudflare-side issue — an *invalid* token is a spam
 * signal, but a *failed verification call* is not.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp: string,
): Promise<boolean | null> {
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, { method: "POST", body });
  } catch (error) {
    console.warn("[form] Turnstile siteverify request failed", error);
    return null;
  }

  if (!response.ok) {
    console.warn("[form] Turnstile siteverify returned", response.status);
    return null;
  }

  const data = (await response.json()) as SiteverifyResponse;
  return data.success === true;
}
