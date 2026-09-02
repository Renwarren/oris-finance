# oris-finance

A from-scratch static Astro rebuild of [oris-finance.com](https://oris-finance.com), a Cameroonian
bank's marketing site.

The live WordPress site is compromised (serving fabricated sitemap spam server-side) and ships
4.20 MB / 129 requests / 3.0s TTFB. This rebuild exists purely for performance on Cameroon 3G/weak
4G: **≤600 KB and ≤35 requests per route**, enforced in CI once that CI script exists.

See `CLAUDE.md` for full architecture and content rules.
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

`/a-propos/` (+ its two sub-pages) and `/retraite-strategique-2026/` — not owned by any WP in
BUILD-PLAN.md §8 (a gap in the plan itself, not an oversight in execution) — were built in
REMEDIATION-PLAN.md PR 5.

Not yet built: `/mentions-legales/`. It's blocked on decision D5 (RCCM, NIU, share capital, and
the regulating authority don't appear anywhere in the extracted content — a bank's legal notice
can't ship half-filled or invented).

French is the source of truth; English is a translation and runs 15–20% shorter, so layouts are
built against French copy first. Zero English content is translated yet — only `/en/` (mirroring
the French placeholder) exists.

## Performance

`npm run check:budget` is the source of truth for the 600 KB / 35-request-per-route budget (it
walks the actual HTML + asset graph in `dist/`, not a sampled trace, so it also counts
below-the-fold `loading="lazy"` images a browser wouldn't fetch on initial paint). Wired into CI
in `.github/workflows/ci.yml`.

Lighthouse (mobile, headless Chrome, `astro preview`, Lighthouse's default simulated-throttling
profile — 150ms RTT, ~1.6 Mbps down, 4x CPU slowdown; this is Lighthouse's "Slow 4G"-class mobile
default, the closest built-in stand-in for the weak-4G/3G connections this project targets, not a
literal 3G profile) on the three heaviest routes as of 2026-08-24 (post REMEDIATION-PLAN.md PR9)
— LCP is well inside the <2.5s DoD target on all three, though see the caveat below:

| Route | Perf | LCP | FCP | TBT | CLS |
|---|---|---|---|---|---|
| `/actualites/…une-semaine-pour-celebrer…/` | 95 | 0.9s | 0.8s | 0ms | 0.138 |
| `/` | 100 | 1.9s | 0.8s | 0ms | 0 |
| `/actualites/…accueille-desormais-les-fonctionnaires…/` | 100 | 1.5s | 1.4s | 0ms | 0.003 |

Caveat: Lighthouse's own "total bytes" figure for these runs undercounts real page weight — it
doesn't scroll, so below-the-fold `loading="lazy"` images never fire during the trace (the
homepage run saw 15 of its 27 requests). `check:budget`'s number is the one that matters for the
budget; per that script (last run 2026-08-24), **all 43 routes pass**. The heaviest is the
"une-semaine" article at **576.4 KB / 15 requests**. The homepage is next at **552.4 KB / 27
requests** (PR9 added a real hero photograph — see `CLAUDE.md`'s "Image resolution" note for the
byte accounting — leaving ~48 KB of headroom against the 600 KB cap), then the "accueille
désormais les fonctionnaires" article at 216.5 KB / 7 requests.
