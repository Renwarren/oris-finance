import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

/**
 * Every collection below scans its whole tree (`fr/`, later `en/`), not a locale-pinned
 * subfolder — the entry `id` carries the locale prefix (e.g. "fr/oris-proxi"). Only `fr/`
 * has files today; no English content has been extracted or translated yet (BUILD-PLAN.md:
 * "French is the source of truth; English is a translation"). Adding `en/*.md` later needs
 * no loader or schema change, just files — WP5/6 filter with `entry.id.startsWith(locale)`.
 *
 * `agencies` has no locale subfolder: an address and phone number aren't translated.
 */

const accounts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/accounts" }),
  schema: ({ image }) =>
    z.object({
      locale: z.enum(["fr", "en"]),
      title: z.string(),
      // The hub's 5-tab grouping (BUILD-PLAN.md §5), not the inline eyebrow text in the
      // source, which mislabels the "organisations" entry as "COMPTES DE DÉPÔTS" too.
      category: z.enum(["depots", "organisations", "courants", "entreprises", "terme"]),
      // Hub display order, matches document order in content-extracted/fr/nos-comptes.md.
      order: z.number().int(),
      // Verbatim from the source's "Minimum à l'ouverture" / "Minimum de souscription" line —
      // kept as a display string, not parsed into a number, so a transcription can't silently
      // corrupt a real financial figure (BUILD-PLAN.md §0: never invent financial content).
      minimum: z.string(),
      image: image().optional(),
    }),
});

const products = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/products" }),
  schema: ({ image }) =>
    z.object({
      locale: z.enum(["fr", "en"]),
      title: z.string(),
      order: z.number().int(),
      items: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
            image: image().optional(),
            link: z.string().optional(),
          }),
        )
        .min(1),
    }),
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    locale: z.enum(["fr", "en"]),
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    sourceUrl: z.url().optional(),
    // The fake-account customer warning gets visible placement, not just another list item
    // (BUILD-PLAN.md §8, WP6) — a content-level flag, not a template-level special case.
    featured: z.boolean().optional(),
  }),
});

const agencies = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/agencies" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      city: z.string(),
      // A route can be one physical address (Bafoussam, Balessing) or several under one
      // page (Douala: Akwa HQ + PK14; Yaoundé: Etoudi + Mokolo + Marché Central) — matches
      // BUILD-PLAN.md §5's fixed 6-route map, which is city-level, not branch-level. Each
      // branch gets its own LocalBusiness JSON-LD via Base.astro's `jsonLd` prop in WP5.
      branches: z
        .array(
          z.object({
            name: z.string(),
            location: z.string(),
            phone: z.string(),
            email: z.email(),
            // Geocoded from `location` via OpenStreetMap Nominatim (REMEDIATION-PLAN.md PR 6).
            // Left omitted rather than guessed whenever the match was ambiguous (multiple
            // plausible POIs, e.g. several same-named fuel stations) or only resolved to a
            // suburb/city centroid rather than the actual address — a wrong pin is worse than
            // no pin. See the PR description for which branches were left out and why.
            geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
            // The Nominatim query used and why the match was trusted, present whenever `geo`
            // is. Never invented — mirrors the `geo` comment above.
            geoSource: z.string().optional(),
            // True only for the one branch that IS the head office (Douala Akwa). Lets
            // src/pages/agences/[slug].astro pull verified opening hours from `hq.hours` in
            // src/i18n/ui.ts into that branch's LocalBusiness JSON-LD without duplicating the
            // hours themselves into this file (single source of truth).
            // TODO(content) D6: no other branch has verified opening hours in
            // content-extracted/ — do not set this, or add hours here, on the assumption a
            // branch matches head office hours.
            isHeadOffice: z.boolean().optional(),
            image: image().optional(),
          }),
        )
        .min(1),
    }),
});

export const collections = { accounts, products, agencies, news };
