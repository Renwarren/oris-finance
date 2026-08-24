# oris-finance

A from-scratch static Astro rebuild of [oris-finance.com](https://oris-finance.com), a Cameroonian
bank's marketing site.

The live WordPress site is compromised (serving fabricated sitemap spam server-side) and ships
4.20 MB / 129 requests / 3.0s TTFB. This rebuild exists purely for performance on Cameroon 3G/weak
4G: **≤600 KB and ≤35 requests per route**, enforced in CI once that CI script exists.

See `CLAUDE.md` for full architecture and content rules. The numbered build plan (§0–§9) that most
in-code comments cite is no longer in the working tree — retrieve it with:

```bash
git show 24f3020:BUILD-PLAN.md
```

## Stack

- **Astro 5**, static output, zero JS by default
- **Tailwind CSS v4** via `@tailwindcss/vite`, configured entirely through the `@theme` block in
  `src/styles/global.css` — no `tailwind.config.js`
- No React, no client-side framework

## Commands

```bash
npm run dev            # astro dev server
npm run build           # production build to dist/
npm run preview         # preview the production build
npm run fonts:fetch     # regenerate public/fonts/*.woff2 + src/styles/fonts.css from Google Fonts
npm run check:budget    # walk dist/ and fail if any route exceeds 600 KB / 35 requests
```

Node >=22.12.0 required. No test suite or linter is configured yet. Type-check `.astro` files with:

```bash
npx astro check
```

## Status

- **WP1** — content extracted from the live site's REST API
- **WP2** — Astro + Tailwind v4 scaffold, design tokens locked (`src/pages/tokens.astro` is a
  rendered reference sheet)
- **WP3** — base layout, i18n routing (`fr` default, `en` at `/en/*`), and SEO scaffolding
  (`sitemap.xml.ts`, `robots.txt`)
- **WP4** — content collections and schemas
- **WP5** — account, product, and agency pages
- **WP6** — homepage, news, and contact
- **WP7** — Cloudflare Workers deploy config, `_redirects`, cache headers
- **WP8** — `scripts/check-budget.ts` + `.github/workflows/ci.yml`, gating `npm run build` on
  the 600 KB / 35-request budget; see Performance below
- **WP9** (stretch, not started) — headless CMS

Not yet built, and not owned by any WP in BUILD-PLAN.md §8 (a gap in the plan itself, not an
oversight in execution — see the repo's build-audit notes): `/a-propos/` and its two sub-pages,
`/mentions-legales/`, `/retraite-strategique-2026/`. Content for all four is already extracted
under `content-extracted/fr/`.

French is the source of truth; English is a translation and runs 15–20% shorter, so layouts are
built against French copy first. Zero English content is translated yet — only `/en/` (mirroring
the French placeholder) exists.

## Performance

`npm run check:budget` is the source of truth for the 600 KB / 35-request-per-route budget (it
walks the actual HTML + asset graph in `dist/`, not a sampled trace, so it also counts
below-the-fold `loading="lazy"` images a browser wouldn't fetch on initial paint). Wired into CI
in `.github/workflows/ci.yml`.

Lighthouse (throttled mobile, headless Chrome, `astro preview`) on the three heaviest routes as
of 2026-08-24 — LCP is well inside the <2.5s DoD target on all three, though see the caveat
below:

| Route | Perf | LCP | FCP | TBT |
|---|---|---|---|---|
| `/actualites/…une-semaine-pour-celebrer…/` | 95 | 1.4s | 1.4s | 0ms |
| `/` | 100 | 1.5s | 1.4s | 0ms |
| `/actualites/…accueille-desormais-les-fonctionnaires…/` | 100 | 1.5s | 1.4s | 0ms |

Caveat: Lighthouse's own "total bytes" figure for these runs (~65–195 KiB) undercounts real page
weight — it doesn't scroll, so lazy-loaded images never fire during the trace. `check:budget`'s
number is the one that matters for the budget; per that script, the "une-semaine" article is
currently **1.3 MB / 15 requests — over budget**, driven by seven full-resolution WhatsApp photos
in one article body. That's the one route CI currently fails on.
