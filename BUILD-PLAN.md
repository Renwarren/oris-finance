# Oris Finance — Astro Rebuild: Build Plan

**Target:** recreate `oris-finance.com` as a static Astro site.
**Hard constraint:** users are in Cameroon on 3G/weak 4G. Every decision answers to page weight.
**Budget:** ≤600 KB and ≤35 requests per route. Enforced in CI, not by good intentions.

Source measurements (taken live 2026-08-21): current site is 4.20 MB / 129 requests / 3.0 s TTFB.
Competitor CCA Bank: 0.56 MB / 29 requests / 0.82 s TTFB.

---

## 0. Read this before starting

- **Do not copy anything executable from the existing WordPress install.** No plugins, no theme
  files, no database dump. The live server is running unauthorised code (see §1). Text and images
  are re-extracted from public HTML and re-encoded. Start from an empty directory.
- **Never invent financial content.** No interest rate, fee, eligibility condition, or product term
  may be written from imagination. If extracted content has a gap, emit `TODO(content):` and raise
  it. For a bank this is a compliance issue, not a copy issue.
- **Load the `frontend-design` skill before writing any component.**
- French is the source of truth. English is a translation.

---

## 1. Known security issue (context, not a build task)

All three sitemap endpoints on the live site — `/sitemap.xml`, `/sitemap_index.xml`, and
WordPress's native `/wp-sitemap.xml` — serve 700–1,100 fabricated Dutch e-commerce URLs each,
stamped with the current date. Each endpoint returns *different* content per request, so a
generator is executing server-side.

Verified: the spam URLs return 404 to both browsers and Googlebot. No cloaking, no live spam
content. The payload appears broken or partially cleaned.

**Implications for this build:**
- The site's own sitemap is unusable as a source of truth. The route map in §5 was obtained by
  crawling navigation and hub pages instead.
- We ship our own `sitemap.xml` (WP3).
- Nobody on this project has server access. Escalation is happening separately.

---

## 2. Design tokens — colour

Derived from the Oris logo by pixel sampling: `#071C9B` (60.4%), `#24B1AF` (14.8%),
`#E40079` (13.7%). **The logo file is never modified or recoloured.**

Two of the three brand colours fail WCAG as interface colours. Contrast ratios measured, not
estimated:

| Token | Hex | On white | Verdict | Permitted use |
|---|---|---|---|---|
| `indigo-500` | `#071C9B` | 12.74:1 | Pass AA | Anywhere — text, nav, primary buttons, footer |
| `indigo-400` | `#465FF7` | 4.95:1 | Pass AA | Links on tinted surfaces, focus rings, hover |
| `indigo-100` | `#E7EAFE` | 1.19:1 | Surface only | Card/section backgrounds. Never text |
| `teal-500` | `#24B1AF` | **2.63:1** | **FAIL** | Fills, icons, large graphics only. **Never text. Never white-on-teal buttons** |
| `teal-700` | `#1A7F7E` | 4.79:1 | Pass AA | The teal used for any text or button. Success states |
| `magenta-500` | `#E40079` | 4.59:1 | Marginal | Display type ≥24px and CTA fills with white text. Not body copy |
| `magenta-600` | `#C20067` | 6.02:1 | Pass AA | Any magenta text at body size. Alerts, key figures |
| `ink` | `#0E1230` | 17.4:1 | Pass AAA | Default body text. Near-black biased toward indigo, never pure black |

Neutral ramp (all biased toward indigo, never flat grey):
`#FBFBFD` `#F2F3F9` `#E1E3F0` `#C9CDE2` `#7A7F9C` `#4B5070` `#0E1230`

**Rule:** every string of text resolves to `ink`, `indigo-500`, `teal-700`, or `magenta-600`.
`teal-500` and `magenta-500` are shapes, not text. No exceptions — the exception is what fails
the audit.

---

## 3. Design tokens — typography

- **Archivo** — headings, figures, labels. Weights 600 and 700.
- **Source Sans 3** — body, forms, tables. Weight 400.

Self-hosted WOFF2, subset to `latin` + `latin-ext` (French accents must not trigger fallback).
Three weights total, **under 60 KB combined**. `font-display: swap`.

Closed type scale — these seven steps and no others. No arbitrary `text-[27px]`:

| Step | Size | Face / weight |
|---|---|---|
| Display | 52 | Archivo 700, `-0.025em` |
| H1 | 40 | Archivo 700, `-0.02em` |
| H2 | 32 | Archivo 700, `-0.018em` |
| H3 | 24 | Archivo 600, `-0.012em` |
| Body | 17 | Source Sans 3 400 |
| Small | 15 | Source Sans 3 400, `ink-2` |
| Label | 11 | Archivo 600, `0.14em`, uppercase |

Rules: body copy ≤65ch. Headings get `text-wrap: balance`. All figures use
`font-variant-numeric: tabular-nums`. Spacing on a 4px grid (4/8/12/16/24/32/48/64/96) using
flex/grid `gap`, never per-element margins. Radius 8px on cards, 4px on inputs — nothing rounder.

---

## 4. Architecture

| Choice | Decision | Reason |
|---|---|---|
| Framework | **Astro 5, static output** | Ships zero JS by default. Content collections + Zod. Native i18n routing |
| Language | **TypeScript strict** | `astro/tsconfigs/strict`. Malformed content fails the build |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | Ramp declared once in `@theme`. Prevents palette drift across 8 work packages |
| Images | **`astro:assets` + Sharp** | Auto AVIF/WebP, generated `srcset`, enforced dimensions |
| Icons | **`astro-icon` + Iconify** | Inlined SVG at build time, zero runtime JS. See §7 |
| Hosting | **Cloudflare Workers static assets** | Edge-served HTML, immutable cache headers, place for the form handler |
| React | **Do not install** | Nothing in the MVP justifies a ~45 KB runtime |

`<details>` handles the mobile nav and accordions. The agency filter is ~30 lines of vanilla TS
that must degrade to a plain list without JS. Keep `@astrojs/react` uninstalled until a feature
genuinely requires it.

### Project structure

```
oris-web/
├── src/
│   ├── content.config.ts        # Zod schemas: agencies, accounts, products, news
│   ├── content/
│   │   ├── news/{fr,en}/*.md
│   │   ├── accounts/{fr,en}/
│   │   ├── products/{fr,en}/
│   │   └── agencies/*.json      # locale-agnostic: address, hours, geo, phone
│   ├── i18n/
│   │   ├── ui.ts                # typed: as const satisfies Record<...>
│   │   └── utils.ts             # getLocale, useTranslations, localePath
│   ├── layouts/
│   │   ├── Base.astro           # lang, hreflang, JSON-LD, skip link
│   │   └── Article.astro
│   ├── components/
│   │   ├── Header.astro         # <details> mobile nav, no framework
│   │   ├── Footer.astro
│   │   ├── AccountCard.astro
│   │   ├── AgencyCard.astro
│   │   ├── NewsCard.astro
│   │   └── Seo.astro            # canonical + hreflang + OG in one place
│   ├── pages/
│   │   ├── [locale]/
│   │   └── sitemap.xml.ts       # ours, replacing the compromised one
│   └── styles/global.css        # @theme tokens — only colour definitions in the repo
├── public/
│   ├── logo-oris.svg            # replaces the 99 KB PNG
│   └── robots.txt
├── scripts/
│   ├── extract-content.ts
│   └── check-budget.ts
├── astro.config.mjs
└── wrangler.toml
```

---

## 5. Route map

Crawled from live navigation and hub pages. ~30 routes per locale, ~60 pages total.

| Route (fr) | Type | Content |
|---|---|---|
| `/` | Landing | Hero, 3 product families, agency locator entry, latest news, trust signals |
| `/a-propos/` | Static | Institution overview, governance, history |
| `/a-propos/mot-du-president-du-conseil-dadministration/` | Static | Chairman's address + portrait |
| `/a-propos/mot-de-ladministrateur-directeur-general/` | Static | Managing Director's address + portrait |
| `/nos-comptes/` | Hub | Index of the 8 account types |
| `/nos-comptes/particulier-non-salarie/` | Collection | Particulier non salarié |
| `/nos-comptes/salaries/` | Collection | Salariés (public / privé) |
| `/nos-comptes/oris-invest/` | Collection | Personne physique / Oris Invest / Oris School |
| `/nos-comptes/entreprises/` | Collection | Établissement / SARL / S.A |
| `/nos-comptes/organisations/` | Collection | Associations / ONG / GIC / Coopératives |
| `/nos-comptes/depot-a-terme/` | Collection | Dépôt à terme |
| `/nos-comptes/bons-de-caisse/` | Collection | Les bons de caisse |
| `/nos-comptes/oris-proxi/` | Collection | Oris Proxi |
| `/nos-produits/` | Hub | Index of the 3 product families |
| `/nos-produits/banque-a-distance/` | Collection | Banque à distance / digital solutions |
| `/nos-produits/bancassurance/` | Collection | Produits de bancassurance |
| `/nos-produits/transfert-et-change/` | Collection | Oris Express, Oris Exchange |
| `/agences/` | Hub | **New.** Filterable index — currently 4 pages with no parent |
| `/agences/douala/` | Collection | Oris Douala |
| `/agences/yaounde/` | Collection | Oris Yaoundé |
| `/agences/bafoussam/` | Collection | Oris Bafoussam |
| `/agences/balessing/` | Collection | Oris Balessing |
| `/agences/kousseri/` | Collection | **New.** Announced in news, no page exists |
| `/agences/bepanda-tonnerre/` | Collection | **New.** Announced in news, no page exists |
| `/actualites/` | Hub | Paginated news index — replaces `/blog/` |
| `/actualites/[slug]/` | Collection | 10 posts incl. the fake-account customer warning |
| `/contacts/` | Static | Form, head office, agency summary |
| `/retraite-strategique-2026/` | Campaign | Carried over |
| `/mentions-legales/` | Static | **New.** Missing today; a bank needs one |
| `/404` | System | Real 404 (current one returns a 92 KB page) |

Set 301 redirects for every old path in `_redirects` so existing rankings survive.

---

## 6. Design direction — anti-slop guardrails

Constraints produce the result here, not more visual invention. The identity is already decided
by the logo; the job is executing it with discipline across 60 pages.

- **Motion budget: CSS only.** No animation library. Hover/focus transitions plus one restrained
  homepage hero reveal. Everything respects `prefers-reduced-motion`. **No scroll-triggered
  animation** — it costs JS and delays content on exactly the connections we're optimising for.
- **One magenta element per screen.** Two magenta CTAs means neither is a CTA.
- **Photography is the site's texture.** Oris has real photos of real branches and real staff —
  the asset stock imagery can't match. Treat as content, sized properly, not as background fills.
- **Visible focus state on every interactive element.** Non-negotiable for a bank.
- **French first.** Design every layout against French copy, which runs 15–20% longer than
  English. Building in English and translating afterwards produces broken buttons.
- On `emilkowalski/skills`: `emil-design-eng` is worth reading for shadow/easing/micro-detail
  quality. Skip the animation skills — they target app UI and pull against the JS budget.

---

## 7. Icons

Reference point: CCA Bank ships **50 inline SVGs and zero icon fonts**. That is the correct
approach and part of why they're at 0.56 MB.

- **Use `astro-icon` with Iconify.** Icons are inlined as SVG at build time. Only the icons
  actually used ship. Zero runtime JS, zero extra requests.
- **Sets:** `lucide` for UI/navigation icons (clean, consistent stroke). `ph` (Phosphor) for
  product and account category icons — it has better financial metaphors and multiple weights.
  Pick one weight and stay on it.
- **Forbidden:** icon fonts (Font Awesome, Material Icons — a separate 70–100 KB request that
  blocks render), `<img>`-based icons, and emoji as UI icons.
- **Sizing:** 20px inline with text, 24px standalone, 32px+ for category cards. Always set
  explicit `width`/`height`. Icons inherit `currentColor` — never hardcode a hex on an icon.
- **Decorative icons get `aria-hidden="true"`.** Icons that carry meaning alone get an accessible
  label. An icon next to a text label is decorative.

```bash
npm i astro-icon
npm i -D @iconify-json/lucide @iconify-json/ph
```

---

## 8. Work packages

Sequenced so each depends only on those before it. WP1 and WP2 must both land before any page is
built — they define the content shapes and tokens everything else consumes.

### WP1 — Extract the content
*No dependencies. Start here.*

WordPress is inaccessible, so content comes from public HTML. Write `scripts/extract-content.ts`
to crawl the 30 routes in §5, strip Elementor wrappers, emit Markdown with frontmatter.

- Download original-resolution images once, re-encode locally. **Never hotlink the live site.**
- Preserve French copy verbatim including accents. Do not paraphrase published product terms.
- Flag anything ambiguous as `TODO(content):` for human review rather than guessing.

### WP2 — Scaffold and lock design tokens
*No dependencies. Can run parallel to WP1.*

Astro 5 + TS strict + Tailwind v4. Validated ramp (§2) into a single `@theme` block in
`global.css`. Self-host Archivo + Source Sans 3 as WOFF2, subset, 3 weights, <60 KB.

**Deliverable:** a rendered token sheet showing every colour, type step, and spacing value.
Review it before any page is built.

### WP3 — Base layout, i18n, SEO
*Depends on WP2.*

`Base.astro` with correct `lang`, `hreflang` pairs, canonical URLs, skip link, Organization +
Place JSON-LD. Header with `<details>` mobile nav and a language switcher that links to the
**translated page**, not the homepage.

Ship `sitemap.xml.ts` in this package — a correct sitemap under our control.

### WP4 — Content collections and schemas
*Depends on WP1 + WP3.*

Define `accounts`, `products`, `agencies`, `news` in `content.config.ts` with Zod. Required
fields genuinely required so a malformed entry fails the build. `agencies` is locale-agnostic
JSON — an address and phone number are not translated.

### WP5 — Product, account, and agency pages
*Depends on WP4.*

21 routes from 3 templates. Build templates against the **longest** French copy in the set.

- `/agences/` filter by region: ~30 lines vanilla TS, must degrade to a plain list without JS
- Each agency page carries LocalBusiness JSON-LD with real coordinates

### WP6 — Homepage, news, contact
*Depends on WP4.*

The homepage is the one page that earns a distinctive treatment; the rest is a system. News index
with pagination, article template, contact form posting to a Cloudflare Worker with Turnstile.

Give the fake-account warning post visible placement — it is customer safety information.

### WP7 — Deploy with redirects and cache headers
*Depends on WP5 + WP6.*

Cloudflare Workers static assets. `_redirects` with a 301 for every old path. Immutable cache
headers on fingerprinted assets, short TTL on HTML.

**Deploy to a preview URL, not the live domain.** WordPress stays up until the boss approves.

### WP8 — Enforce the budget in CI
*Depends on WP7.*

`scripts/check-budget.ts` walks `dist/` and exits non-zero if any route exceeds 600 KB or 35
requests. Without this the site drifts back within a year — precisely how the current one reached
4.2 MB.

Run Lighthouse on throttled 3G against the three heaviest routes; record the numbers.

### WP9 — Headless CMS *(stretch — do not start until WP1–WP8 are done)*
*Depends on WP4 + WP7.*

**Why this exists:** the MVP ships content as Markdown in the repo, which is correct for a site
built by one developer. It is not the long-term answer — Oris's communications team will not
learn git.

**Why hosted, not self-hosted:** Oris was just compromised on self-hosted software (§1).
Recommending another self-hosted PHP/Node CMS puts the same attack surface back on their domain.
A hosted CMS removes it entirely.

| Option | Hosting | Cost | i18n | Editor login | Verdict |
|---|---|---|---|---|---|
| **Sanity** | Hosted | Free tier: 3 users, 10k docs | Document-level i18n plugin | Email/Google | **Recommended** |
| **Storyblok** | Hosted | Free tier available | Strong, field-level | Email | Good alternative; visual editor |
| **Directus** | Self-host or cloud | Free self-host | Built-in translations field | Email | Only if data residency is a compliance requirement |
| **Keystatic** | Git-backed | Free | Manual | **GitHub account** | Zero cost, but GitHub login rules it out for comms staff |

**The key architectural point:** Astro 5's Content Layer API means this is a *loader swap*, not a
rewrite. The Zod schemas from WP4 survive unchanged — only the loader changes from `glob()` to a
Sanity loader. Nothing built in WP1–WP8 is wasted.

```ts
// WP4 (MVP)                      // WP9 (CMS)
loader: glob({ ... })       →     loader: sanityLoader({ ... })
schema: z.object({ ... })   →     schema: z.object({ ... })  // unchanged
```

Tasks:
1. Model `accounts`, `products`, `agencies`, `news` in Sanity Studio, matching the WP4 schemas.
2. Migrate Markdown content into Sanity (one-off script).
3. Swap the content collection loaders.
4. Sanity webhook → Cloudflare deploy hook. Content edits go live in ~1–2 min, which is fine for
   a marketing site.
5. Deploy Sanity Studio (free) and hand comms a login. Set the Studio UI to French.

---

## 9. Definition of done

- [ ] Every route ≤600 KB and ≤35 requests, verified by the budget script, not estimated
- [ ] LCP <2.5 s on throttled 3G for homepage, one account page, one news article
- [ ] Zero JavaScript on ≥25 of 30 routes; any route shipping JS names the feature that required it
- [ ] Every page renders correctly with JS disabled, including agency filter and mobile nav
- [ ] No colour outside the token set anywhere — grep the build output for stray hex values
- [ ] All text passes WCAG AA; `teal-500` and `magenta-500` confirmed absent from every text rule
- [ ] Both locales complete; every `hreflang` pair resolves; language switcher lands on the equivalent page
- [ ] Every old URL 301s to its new location, tested against the §5 route list
- [ ] Keyboard navigation works end to end with a visible focus state on every interactive element
- [ ] Icons inlined as SVG; no icon font, no `<img>` icons, no emoji as UI
- [ ] **No financial figure, rate, or product term differs from the live site.** Anything uncertain
      is flagged `TODO(content):`, never invented
