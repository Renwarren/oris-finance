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
- **WP6** — homepage, news, and contact — not started

French is the source of truth; English is a translation and runs 15–20% shorter, so layouts are
built against French copy first.
