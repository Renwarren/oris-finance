import type { MailDelivery } from "./mail";

/**
 * Hand-maintained rather than `wrangler types`-generated (workers-best-practices normally
 * recommends the latter, to avoid drift) because two of these three bindings don't exist yet —
 * `wrangler types` can only reflect what wrangler.toml actually declares, and MAIL_DELIVERY and
 * TURNSTILE_SECRET are deliberately undeclared pending D1 (see wrangler.toml's "Form delivery"
 * comment and REMEDIATION-PLAN.md PR3). Regenerate this by hand — or switch to `wrangler types`
 * and re-add the two optional fields below — once D1 is answered and wrangler.toml gains real
 * bindings for them.
 */
export interface Env {
  /** Static assets binding — declared in wrangler.toml's [assets] block, always present. */
  ASSETS: Fetcher;

  /**
   * Cloudflare Turnstile secret key. Set with `wrangler secret put TURNSTILE_SECRET` once a
   * Turnstile site exists (D1). Undefined today, so worker/lib/turnstile.ts's verification step
   * is always skipped and every submission falls back to the honeypot+timing baseline in
   * worker/lib/antispam.ts — see README.md "Secrets".
   */
  TURNSTILE_SECRET?: string;

  /**
   * Single named delivery binding, deliberately abstracted (REMEDIATION-PLAN.md PR3: "abstract
   * the actual provider, don't hardcode one" — D1 is unanswered). Not a real Cloudflare binding
   * yet; see wrangler.toml's "Form delivery" comment for the two shapes it might take once D1
   * lands. worker/lib/mail.ts falls back to a no-op logger when this is undefined, which is
   * always, today.
   */
  MAIL_DELIVERY?: MailDelivery;
}
