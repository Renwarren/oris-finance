/**
 * REMEDIATION-PLAN.md PR3: combines the honeypot+timing baseline (worker/lib/antispam.ts, always
 * on, JS-free) with Turnstile (worker/lib/turnstile.ts, progressive enhancement) into the one
 * check both handlers call. "When a Turnstile token is present, verify it; when absent, fall
 * back to the baseline. A working Turnstile token must never be a hard requirement."
 */
import type { Env } from "./env";
import { passesHoneypot, passesTiming } from "./antispam";
import { verifyTurnstile } from "./turnstile";

/** The Cloudflare Turnstile widget's own default hidden-input name — set automatically by its
 *  script (challenges.cloudflare.com/turnstile/v0/api.js), not something this repo names. */
const TURNSTILE_FIELD_NAME = "cf-turnstile-response";

export async function passesAntiSpam(
  request: Request,
  formData: FormData,
  env: Env,
  ip: string,
): Promise<boolean> {
  // The honeypot applies regardless of Turnstile — an empty honeypot field costs a legitimate
  // visitor nothing, so there's no reason to let a valid-looking Turnstile token skip it.
  if (!passesHoneypot(formData)) {
    console.warn("[form] honeypot field was filled in — rejecting");
    return false;
  }

  const token = formData.get(TURNSTILE_FIELD_NAME);
  if (typeof token === "string" && token.length > 0 && env.TURNSTILE_SECRET) {
    const verified = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
    if (verified === true) return true; // stronger check passed — baseline timing not required
    if (verified === false) {
      console.warn("[form] Turnstile token present but invalid — rejecting");
      return false;
    }
    // verified === null: the siteverify call itself failed (network/Cloudflare-side issue) —
    // don't punish the visitor for that; fall through to the baseline below.
  }

  if (!passesTiming(request)) {
    console.warn("[form] submission arrived faster than MIN_SUBMIT_MS allows — rejecting");
    return false;
  }

  return true;
}
