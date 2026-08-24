/**
 * Names shared between the two Astro form pages and worker/lib/antispam.ts (REMEDIATION-PLAN.md
 * PR3). Plain constants only — no logic — so they can be imported from `src/pages/*.astro`
 * (built by Astro/Vite) without pulling any Worker-only code (Cloudflare-specific types, etc.)
 * into the static site build.
 *
 * `HONEYPOT_FIELD_NAME`: a form field real visitors never see or fill (CSS-hidden off-screen,
 * `tabindex="-1"`, `aria-hidden="true"`, `autocomplete="off"`) that most unsophisticated bots
 * fill anyway because they fill every field in a form. Non-empty on submit = reject.
 *
 * `TIMING_COOKIE_NAME`: worker/index.ts sets this cookie (value = server timestamp) on GET
 * requests to the two form pages — see wrangler.toml's `run_worker_first` comment for why that
 * requires opting those two routes back into the Worker. The POST handlers read it back and
 * reject submissions faster than a human could plausibly fill the form. This is the
 * "submission-timing check" BUILD-PLAN.md §9 and REMEDIATION-PLAN.md PR3 call for as half of the
 * JS-free anti-spam baseline (the other half is the honeypot above) — it works with JavaScript
 * disabled because it rides on an ordinary Set-Cookie response header, not a script.
 */
export const HONEYPOT_FIELD_NAME = "website";
export const TIMING_COOKIE_NAME = "of_ft";
