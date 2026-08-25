# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A from-scratch static Astro rebuild of `oris-finance.com`, a Cameroonian bank's marketing site.
The live WordPress site is compromised (serving fabricated sitemap spam server-side — see git
history below) and is 4.20 MB / 129 requests / 3.0s TTFB. The rebuild's entire reason for existing
is performance for users on Cameroon 3G/weak 4G: **≤600 KB and ≤35 requests per route**, enforced
in CI (`.github/workflows/ci.yml` runs `scripts/check-budget.ts` on every push/PR), not by good
intentions.

## Commands

```bash
npm run dev            # astro dev server
npm run build           # production build to dist/
npm run preview         # preview the production build
npm run fonts:fetch     # regenerate public/fonts/*.woff2 + src/styles/fonts.css from Google Fonts
npm run check:budget    # walk dist/ and fail if any route exceeds 600 KB / 35 requests
npm run deploy          # deploy to Cloudflare Workers
```

Node >=22.12.0 required (see `package.json` engines). No test suite or linter is configured yet.
Type-checking is via `astro/tsconfigs/strict` (`tsconfig.json`) — run `npx astro check` to surface
type errors across `.astro` files.

## Architecture

- **Astro 5, static output** (`output: "static"` in `astro.config.mjs`). Ships zero JS by default;
  stay that way unless a specific feature genuinely requires a script (e.g. the planned agency
  filter, which must degrade to a plain list with JS disabled).
- **React is intentionally not installed.** Nothing in the MVP justifies the runtime cost — don't
  add `@astrojs/react` casually.
- **Tailwind CSS v4** via `@tailwindcss/vite`, configured entirely through CSS (`@theme` in
  `src/styles/global.css`), not a `tailwind.config.js`.
- **Design tokens live in exactly one place**: the `@theme` block in `src/styles/global.css`.
  Never add ad-hoc hex values or arbitrary Tailwind values (`text-[27px]`, `bg-[#123456]`)
  anywhere else — extend that block instead. `src/pages/tokens.astro` is a rendered reference
  sheet of every token; if a value looks wrong there, fix the token, not the page.
  - **Colour**: text must resolve to one of `ink` / `indigo-500` / `teal-700` / `magenta-600`,
    plus `neutral-500` / `neutral-100` for secondary/meta text (timestamps, captions, footer) —
    both clear WCAG AAA (7.6:1, 11.5:1). `teal-500` and `magenta-500` fail WCAG AA as text and
    are fills/icons/shapes only, never text.
  - **Type**: a closed 7-step scale (display, h1, h2, h3, body, small, label) — no arbitrary sizes.
    Archivo (600/700) for headings/figures/labels, Source Sans 3 (400) for body/forms/tables.
  - **Spacing**: stock Tailwind v4 4px scale (`--spacing: 0.25rem`); use `gap`, never per-element
    margins.
  - **Radius**: `--radius-card` (8px), `--radius-input` (4px) — nothing rounder.
  - Every figure/amount uses the `tabular-nums` utility (defined in `global.css`) so columns align.
- **Fonts are self-hosted and generated, not hand-edited.** `scripts/fetch-fonts.ts` fetches
  Google Fonts' CSS2 endpoint, keeps only the `latin` subset (deliberately excludes `latin-ext` —
  see the script's header comment for the contrast-ratio-style reasoning on why that's still
  correct for French copy), downloads the woff2 files into `public/fonts/`, and regenerates
  `src/styles/fonts.css`. That file has a `do not hand-edit` header; change the script and re-run
  `npm run fonts:fetch` instead. Combined budget is <60 KB across all weights.
- **Icons**: not yet wired up. Plan is `astro-icon` + Iconify (`lucide` for UI/nav, `ph` for
  product/account categories) — inlined SVG at build time, zero runtime JS. Icon fonts and `<img>`
  icons are forbidden.
- **Image resolution (`widths`/`densities`)** is decided per image, not applied uniformly — every
  `<Image>` still ships at 1x unless a comment next to the call says otherwise (REMEDIATION-PLAN.md
  PR8). The rule that produced today's split:
  - **Homepage "reason" images** (`src/pages/index.astro`) are the largest on-screen images on the
    site outside a hero — up to half of the `max-w-6xl` section, well past their 480px intrinsic
    width on desktop. Three of the four ship `densities={[1, 2]}`: the source photos are large
    enough for a genuine (not upscaled) 2x, and the route had ~330 KB of budget headroom. The
    fourth (the Bafoussam branch exterior) stays 1x — it's the priciest of the four to double
    (busy, high-contrast street scene; +118 KB vs +66–94 KB for the other three) and adding it
    would push the route past the ~500 KB stop-line the plan sets. Homepage: 266.1 KB → 493.5 KB.
  - **The homepage hero image** (REMEDIATION-PLAN.md PR9) reuses the same source photo as the
    "L'expertise" reason image above, at a wider 800×400 crop, 1x only, `loading="eager"` +
    `fetchpriority="high"` since it's the LCP element. No 2x: at this size it's already the
    single most expensive image on the route (~48 KB), and doubling it would burn most of the
    remaining headroom left after PR4's icon merge (502.7 KB before this image, 600 KB cap) for
    a photo that's above the fold on a 3G connection — bytes there cost LCP time directly, which
    matters more than retina sharpness. Homepage after PR4 + this hero: 502.7 KB → 551.1 KB.
  - **Account-page hero images** (`src/pages/nos-comptes/[slug].astro`, rendered at 800×450) stay
    1x everywhere, budget headroom notwithstanding. Their source photos are stock imagery, mostly
    only 350×350 or 960×540 — already smaller than the 800×450 render, so even the *current* 1x
    output is an upscale. A 2x density on top would cost bytes for zero additional real detail.
    Fixing that needs higher-resolution source images, which is a content problem, not a `widths`/
    `densities` omission — out of scope here.
  - **Every card/tile image** (account and product category tiles, agency cards, product-family
    covers, product item logos) stays 1x: they render at ≤320×200 inside a grid, materially
    smaller on screen than the homepage reason images, so the budget is better spent there first
    (REMEDIATION-PLAN.md PR8: "prioritize by visible size impact"). Agency branch photos
    (`AgencyCard.astro`, `src/pages/agences/[slug].astro`) have source resolution that *would*
    support a real 2x, and plenty of per-route headroom — revisit them first if this gets
    reopened, ahead of the account heroes above, which cannot benefit at all.
- **Photo alt text**: a real French description (what's visibly in the frame, nothing invented —
  see Content rules below) for actual content photography — branch exteriors, staff/team photos,
  news photos. `alt=""` is reserved for genuinely decorative images: a category tile or product
  logo whose adjacent heading/label already names the same thing. Each `alt=""` in the codebase has
  a comment saying which case it is, so an empty alt always reads as a decision, not a gap.
- **Hosting**: planned Cloudflare Workers static assets, with a `_redirects` 301 for every old
  live-site URL and a custom `sitemap.xml.ts` (the live site's sitemap endpoints are compromised
  and unusable as a source of truth).

## Content rules (apply to any future work touching real site content)

- **Never invent financial content.** No rate, fee, eligibility condition, or product term may be
  written from imagination — for a bank this is a compliance issue. Flag gaps as `TODO(content):`.
- **Never copy anything executable from the live WordPress install** (plugins, theme, DB dump) —
  it's compromised. Content is re-extracted from public HTML; images re-encoded locally, never
  hotlinked from the live site.
- **French is the source of truth; English is a translation.** Design/build against French copy,
  which runs 15–20% longer than English — building against English first produces broken layouts.

## Current state

WP1–WP8 are merged to `main`: content extraction, scaffold/tokens, base layout + i18n + SEO,
content collections, account/product/agency pages, homepage/news/contact, Cloudflare deploy
config + redirects + cache headers, and the CI budget gate (`scripts/check-budget.ts`). Zero
English content has been translated; `/en/*` routes exist structurally but mirror the French
placeholder. `/a-propos/` (+ sub-pages), `/mentions-legales/`, and `/retraite-strategique-2026/`
are extracted content with no owning WP (a gap in BUILD-PLAN.md §8 itself, not an oversight).
WP9 (headless CMS) is a stretch goal, not started. See `README.md` `## Status` for details —
it's kept current; this section can drift.

**Known deviation from `BUILD-PLAN.md` §5:** §5 specifies the account-hub slug
`/nos-comptes/oris-invest/`; the repo built `/nos-comptes/personne-physique/` instead, and that is
the slug that ships. This was a deliberate call (post-audit decision, REMEDIATION-PLAN.md PR10,
item D3), not a bug — the built slug wins, no rename, no 301. Noted here so the route map and the
repo stop disagreeing; treat `/nos-comptes/personne-physique/` as canonical if you touch this route.
