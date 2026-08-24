/**
 * REMEDIATION-PLAN.md PR3 (BUILD-PLAN.md §8 WP6): fronts the static asset bundle so
 * `POST /api/contact` and `POST /api/ouvrir-un-compte` — previously hard 404s, since no Worker
 * script existed — actually work. Everything else falls straight through to
 * `env.ASSETS.fetch()`, unchanged from the assets-only deployment this replaces.
 *
 * wrangler.toml's `run_worker_first` also routes GET requests for the two form pages here (not
 * just their POST targets) — see that file's comment — so this Worker can stamp the
 * submission-timing cookie the honeypot+timing anti-spam baseline (worker/lib/antispam.ts)
 * reads back on submit.
 */
import type { Env } from "./lib/env";
import { withTimingCookie } from "./lib/antispam";
import { handleContact } from "./handlers/contact";
import { handleOuvrirUnCompte } from "./handlers/ouvrir-un-compte";

/** Exact pathnames (no trailing-slash ambiguity — Astro's static output always emits these with
 *  a trailing slash) that get the timing cookie stamped onto their GET response. */
const FORM_PAGE_PATHS = new Set(["/contacts/", "/ouvrir-un-compte/"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/contact") {
      return handleContact(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/ouvrir-un-compte") {
      return handleOuvrirUnCompte(request, env);
    }

    const response = await env.ASSETS.fetch(request);

    if (request.method === "GET" && FORM_PAGE_PATHS.has(url.pathname)) {
      return withTimingCookie(response, request);
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
