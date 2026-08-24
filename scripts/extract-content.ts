/**
 * WP1 — extract content from the live oris-finance.com public HTML / REST API.
 *
 * Why REST API, not HTML scraping: /wp-json/wp/v2/{pages,posts} returns each item's own
 * content.rendered fragment (Elementor markup, but with site chrome — header/nav/footer/
 * scripts — already excluded). That's a smaller, steadier extraction surface than diffing
 * rendered pages against a hand-written chrome-stripping heuristic, and the compromise
 * described in BUILD-PLAN.md §1 is isolated to the sitemap generators, not this API.
 *
 * Never hotlinks the live site: every image referenced in kept content is downloaded once
 * to content-extracted/images/ and the markdown points at the local copy.
 *
 * Output: content-extracted/fr/<route>.md (+ MANIFEST.md summary). This is raw extracted
 * material, not final content-collection entries — WP4 reshapes it into the Zod schemas.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const SITE = "https://oris-finance.com";
const OUT_DIR = join(process.cwd(), "content-extracted");
const FR_DIR = join(OUT_DIR, "fr");
const IMAGES_DIR = join(OUT_DIR, "images");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// WordPress REST client
// ---------------------------------------------------------------------------

interface WpItem {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
}

async function fetchAllRest(type: "pages" | "posts"): Promise<Map<string, WpItem>> {
  const url = `${SITE}/wp-json/wp/v2/${type}?per_page=100&_fields=id,slug,link,date,title,content,excerpt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`REST fetch failed for ${type}: ${res.status}`);
  const items = (await res.json()) as WpItem[];
  return new Map(items.map((item) => [item.slug, item]));
}

// ---------------------------------------------------------------------------
// HTML cleaning + markdown conversion
// ---------------------------------------------------------------------------

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "form",
  "iframe",
  ".elementor-widget-divider",
  ".elementor-icon-wrapper:not(:has(a))",
  ".elementor-shape",
  "[class*='sr7-']",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "_",
});

/** Mathematical-bold / full-width copy-paste text (see the "faux compte" post) folds
 *  back to plain Latin under NFKC — French accents are untouched by this normalization. */
function cleanText(text: string): string {
  return text.normalize("NFKC").replace(/ /g, " ").trim();
}

interface ImageDownloader {
  resolve(rawSrc: string, routeSlug: string): Promise<string | null>;
}

function makeImageDownloader(): ImageDownloader {
  const cache = new Map<string, string | null>();

  return {
    async resolve(rawSrc, routeSlug) {
      const absolute = new URL(rawSrc, SITE).toString();
      if (cache.has(absolute)) return cache.get(absolute)!;

      const filename = absolute.split("/").pop()!.split("?")[0];
      if (/logo|favicon|placeholder|cropped-logo/i.test(filename)) {
        cache.set(absolute, null);
        return null;
      }

      // WP serves resized crops as name-WIDTHxHEIGHT.ext; strip that to get the original.
      const originalUrl = absolute.replace(/-\d+x\d+(?=\.\w+$)/, "");
      const candidates = originalUrl === absolute ? [absolute] : [originalUrl, absolute];

      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const localName = candidate.split("/").pop()!.split("?")[0];
          const localDir = join(IMAGES_DIR, routeSlug);
          await mkdir(localDir, { recursive: true });
          await writeFile(join(localDir, localName), buf);
          const relPath = `../images/${routeSlug}/${localName}`;
          cache.set(absolute, relPath);
          return relPath;
        } catch {
          // try next candidate
        }
      }
      cache.set(absolute, null);
      return null;
    },
  };
}

async function htmlFragmentToMarkdown(
  html: string,
  routeSlug: string,
  images: ImageDownloader,
): Promise<string> {
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  $(NOISE_SELECTORS.join(",")).remove();

  const root = $("#__root");
  const imgs = root.find("img").toArray();
  for (const img of imgs) {
    const $img = $(img);
    const src = $img.attr("src");
    if (!src) {
      $img.remove();
      continue;
    }
    const local = await images.resolve(src, routeSlug);
    if (local) {
      $img.attr("src", local);
      $img.removeAttr("srcset").removeAttr("sizes");
    } else {
      $img.remove(); // decorative/unrecoverable — dropped, not hotlinked
    }
  }

  const markdown = turndown.turndown(root.html() ?? "");
  return cleanText(markdown.replace(/\n{3,}/g, "\n\n"));
}

// ---------------------------------------------------------------------------
// Section splitting for hub pages whose live content is one page covering
// several target routes (nos-comptes: 8 account types on 1 page).
// ---------------------------------------------------------------------------

/**
 * Verified against the live markup (2026-08-24): every account-type heading on
 * /nos-comptes/ is the sole heading inside its own tight `.e-con.e-child` wrapper
 * (heading + fee/eligibility list + CTA, nothing else), immediately followed by a
 * sibling `.e-con.e-child` holding just that account type's photo. That pairing
 * is what makes an automated split trustworthy here — see MANIFEST.md for the
 * one page (nos-produits) where the layout is looser and this was NOT attempted.
 */
function sectionForHeading($: cheerio.CheerioAPI, keywords: RegExp): string | null {
  const heading = $("h1,h2,h3,h4")
    .toArray()
    .find((el) => keywords.test(cleanText($(el).text())));
  if (!heading) return null;

  const block = $(heading).closest(".e-con.e-child");
  if (!block.length) return null;

  let html = block.html() ?? "";
  const nextSibling = block.next(".e-con.e-child");
  if (nextSibling.length && nextSibling.find("h1,h2,h3,h4").length === 0) {
    html += nextSibling.html() ?? "";
  }
  return html;
}

// ---------------------------------------------------------------------------
// Route manifest — derived from BUILD-PLAN.md §5 cross-referenced against a
// live crawl of oris-finance.com on 2026-08-23/24 (wp-json/wp/v2/pages+posts,
// plus rendered nav/hub HTML for pages not exposed as REST content).
// ---------------------------------------------------------------------------

type Route =
  | { slug: string; kind: "page"; wpSlug: string }
  | { slug: string; kind: "hub-section"; hubWpSlug: string; match: RegExp; label: string }
  | { slug: string; kind: "post"; wpSlug: string }
  | { slug: string; kind: "post-provisional"; wpSlug: string; note: string }
  | { slug: string; kind: "todo"; reason: string };

const ROUTES: Route[] = [
  { slug: "", kind: "page", wpSlug: "accueil" },
  { slug: "a-propos", kind: "page", wpSlug: "a-propos" },
  {
    slug: "a-propos/mot-du-president-du-conseil-dadministration",
    kind: "page",
    wpSlug: "mot-du-president-du-conseil-dadministration",
  },
  {
    slug: "a-propos/mot-de-ladministrateur-directeur-general",
    kind: "page",
    wpSlug: "mot-de-ladministrateur-directeur-general",
  },

  { slug: "nos-comptes", kind: "page", wpSlug: "nos-comptes" },
  {
    slug: "nos-comptes/particulier-non-salarie",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /PARTICULIER NON SALARI/i,
    label: "Particulier non salarié",
  },
  {
    slug: "nos-comptes/salaries",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /SALARI[EÉ]S/i,
    label: "Salariés",
  },
  {
    slug: "nos-comptes/oris-invest",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /ORIS INVEST|PERSONNE PHYSIQUE/i,
    label: "Personne physique / Oris Invest / Oris School",
  },
  {
    slug: "nos-comptes/entreprises",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /[EÉ]TABLISSEMENT|SARL|S\.A/i,
    label: "Établissement / SARL / S.A",
  },
  {
    slug: "nos-comptes/organisations",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /ORGANISATION|ASSOCIATION|ONG|GIC|COOP[EÉ]RATIVE/i,
    label: "Associations / ONG / GIC / Coopératives",
  },
  {
    slug: "nos-comptes/depot-a-terme",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /D[EÉ]P[OÔ]T [AÀ] TERME/i,
    label: "Dépôt à terme",
  },
  {
    slug: "nos-comptes/bons-de-caisse",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /BONS DE CAISSE/i,
    label: "Les bons de caisse",
  },
  {
    slug: "nos-comptes/oris-proxi",
    kind: "hub-section",
    hubWpSlug: "nos-comptes",
    match: /ORIS PROXI/i,
    label: "Oris Proxi",
  },

  { slug: "nos-produits", kind: "page", wpSlug: "nos-produits" },
  // /nos-produits/ does NOT use the clean `.e-con.e-child`-per-heading layout that makes the
  // nos-comptes split trustworthy (verified 2026-08-24: each family heading sits in a section
  // with an empty sibling column, and the actual body copy lives in separate following sections
  // with no heading to anchor on). Auto-slicing here risks silently dropping product copy — a
  // compliance issue per BUILD-PLAN.md §0 — so these three are TODOs pointing at the full hub
  // dump (content-extracted/fr/nos-produits.md) for a human to carve out by hand in WP4.
  {
    slug: "nos-produits/banque-a-distance",
    kind: "todo",
    reason:
      "Not auto-extracted — /nos-produits/ layout has no reliable per-family section boundary " +
      "(see comment above ROUTES). Carve this out of content-extracted/fr/nos-produits.md by hand.",
  },
  {
    slug: "nos-produits/bancassurance",
    kind: "todo",
    reason:
      "Not auto-extracted — /nos-produits/ layout has no reliable per-family section boundary " +
      "(see comment above ROUTES). Carve this out of content-extracted/fr/nos-produits.md by hand.",
  },
  {
    slug: "nos-produits/transfert-et-change",
    kind: "todo",
    reason:
      "Not auto-extracted — /nos-produits/ layout has no reliable per-family section boundary " +
      "(see comment above ROUTES). Carve this out of content-extracted/fr/nos-produits.md by hand.",
  },

  {
    slug: "agences",
    kind: "todo",
    reason:
      "New page (BUILD-PLAN.md §5): no live equivalent. Today the 4 agency pages have no shared " +
      "parent/index. Needs a short French intro blurb from Oris plus the filterable list wired in WP5.",
  },
  { slug: "agences/douala", kind: "page", wpSlug: "oris-douala" },
  { slug: "agences/yaounde", kind: "page", wpSlug: "oris-yaounde" },
  { slug: "agences/bafoussam", kind: "page", wpSlug: "oris-bafoussam" },
  { slug: "agences/balessing", kind: "page", wpSlug: "oris-balessing" },
  {
    slug: "agences/kousseri",
    kind: "post-provisional",
    wpSlug: "oris-finance-s-a-ouvre-une-nouvelle-agence-a-kousseri-et-renforce-sa-presence-a-lextreme-nord",
    note:
      "No dedicated agency page exists yet — only this announcement post. It has no address, " +
      "phone, opening hours, or coordinates, all required by the agencies schema (WP4). Confirm " +
      "with Oris before this becomes a real agency page.",
  },
  {
    slug: "agences/bepanda-tonnerre",
    kind: "post-provisional",
    wpSlug: "oris-finance-s-a-sinstalle-a-bepanda-tonnerre-une-nouvelle-agence-100-operationnelle",
    note:
      "No dedicated agency page exists yet — only this announcement post. It has no address, " +
      "phone, opening hours, or coordinates, all required by the agencies schema (WP4). Confirm " +
      "with Oris before this becomes a real agency page.",
  },

  { slug: "contacts", kind: "page", wpSlug: "contacts" },
  // Despite being its own route/campaign in §5, this is a WP *post*, not a page, on the live site.
  { slug: "retraite-strategique-2026", kind: "post", wpSlug: "retraite-strategique-2026" },
  {
    slug: "mentions-legales",
    kind: "todo",
    reason:
      "Live URL returns 404 (BUILD-PLAN.md §5: 'Missing today; a bank needs one'). Needs RCCM/NIU, " +
      "share capital, regulator (COBAC/MINFI), publication director, and hosting-provider details " +
      "from Oris's legal/compliance team — none of this may be invented.",
  },
];

// News: every WP post except the standalone campaign page 'retraite-strategique-2026' (already
// listed above as its own page). Route slugs reuse the WP slug, except the one written entirely
// in styled Unicode (see cleanText/NFKC note) which gets a derived ASCII slug so the URL is sane.
const NEWS_SLUG_OVERRIDES: Record<string, string> = {
  "%f0%9d%90%80%f0%9d%90%8b%f0%9d%90%84%f0%9d%90%91%f0%9d%90%93%f0%9d%90%84-%f0%9d%90%85%f0%9d%90%9a%f0%9d%90%ae%f0%9d%90%b1-%f0%9d%90%9c%f0%9d%90%a8%f0%9d%90%a6%f0%9d%90%a9%f0%9d%90%ad%f0%9d%90%9e":
    "alerte-faux-compte",
};

// ---------------------------------------------------------------------------
// Per-route extraction
// ---------------------------------------------------------------------------

interface ManifestRow {
  route: string;
  status: "ok" | "todo" | "provisional";
  sourceUrl: string | null;
  words: number;
  images: number;
}

function frontmatter(fields: Record<string, string | null>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v === null ? "null" : JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

async function writeRoute(routeSlug: string, content: string): Promise<void> {
  const path = routeSlug === "" ? join(FR_DIR, "index.md") : join(FR_DIR, `${routeSlug}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function main() {
  await mkdir(FR_DIR, { recursive: true });
  await mkdir(IMAGES_DIR, { recursive: true });

  console.log("Fetching WP REST indexes...");
  const [pages, posts] = await Promise.all([fetchAllRest("pages"), fetchAllRest("posts")]);
  console.log(`  ${pages.size} pages, ${posts.size} posts`);

  const images = makeImageDownloader();
  const manifest: ManifestRow[] = [];
  const hubCache = new Map<string, cheerio.CheerioAPI>();

  function loadHub(wpSlug: string): { $: cheerio.CheerioAPI; item: WpItem } | null {
    const item = pages.get(wpSlug);
    if (!item) return null;
    if (!hubCache.has(wpSlug)) {
      hubCache.set(wpSlug, cheerio.load(`<div id="__root">${item.content.rendered}</div>`));
    }
    return { $: hubCache.get(wpSlug)!, item };
  }

  for (const route of ROUTES) {
    await sleep(150);

    if (route.kind === "todo") {
      await writeRoute(
        route.slug,
        frontmatter({
          title: `TODO(content): ${route.slug || "home"}`,
          sourceUrl: null,
          extractedAt: new Date().toISOString(),
          locale: "fr",
          status: "todo",
        }) + `TODO(content): ${route.reason}\n`,
      );
      manifest.push({ route: route.slug, status: "todo", sourceUrl: null, words: 0, images: 0 });
      continue;
    }

    if (route.kind === "page") {
      const item = pages.get(route.wpSlug);
      if (!item) {
        console.warn(`  MISSING page slug "${route.wpSlug}" for route /${route.slug}/`);
        manifest.push({ route: route.slug, status: "todo", sourceUrl: null, words: 0, images: 0 });
        continue;
      }
      const title = cleanText(item.title.rendered);
      const description = cleanText(item.excerpt.rendered.replace(/<[^>]+>/g, "")).slice(0, 160);
      const body = await htmlFragmentToMarkdown(item.content.rendered, route.slug || "home", images);
      const fm = frontmatter({
        title,
        description,
        sourceUrl: item.link,
        extractedAt: new Date().toISOString(),
        locale: "fr",
        status: "ok",
      });
      await writeRoute(route.slug, fm + body + "\n");
      manifest.push({
        route: route.slug,
        status: "ok",
        sourceUrl: item.link,
        words: body.split(/\s+/).filter(Boolean).length,
        images: (body.match(/!\[/g) ?? []).length,
      });
      continue;
    }

    if (route.kind === "hub-section") {
      const hub = loadHub(route.hubWpSlug);
      if (!hub) {
        manifest.push({ route: route.slug, status: "todo", sourceUrl: null, words: 0, images: 0 });
        continue;
      }
      const panelHtml = sectionForHeading(hub.$, route.match);

      if (!panelHtml) {
        console.warn(`  No section matched "${route.match}" on hub "${route.hubWpSlug}" for /${route.slug}/`);
        await writeRoute(
          route.slug,
          frontmatter({
            title: `TODO(content): ${route.label}`,
            sourceUrl: hub.item.link,
            extractedAt: new Date().toISOString(),
            locale: "fr",
            status: "todo",
          }) +
            `TODO(content): expected a section titled "${route.label}" on ${hub.item.link} ` +
            `but the automated match found none. The hub markup may have changed — check by hand.\n`,
        );
        manifest.push({ route: route.slug, status: "todo", sourceUrl: hub.item.link, words: 0, images: 0 });
        continue;
      }

      const body = await htmlFragmentToMarkdown(panelHtml, route.slug, images);
      const fm = frontmatter({
        title: route.label,
        sourceUrl: hub.item.link,
        extractedAt: new Date().toISOString(),
        locale: "fr",
        status: "ok",
      });
      await writeRoute(route.slug, fm + `# ${route.label}\n\n` + body + "\n");
      manifest.push({
        route: route.slug,
        status: "ok",
        sourceUrl: hub.item.link,
        words: body.split(/\s+/).filter(Boolean).length,
        images: (body.match(/!\[/g) ?? []).length,
      });
      continue;
    }

    if (route.kind === "post" || route.kind === "post-provisional") {
      const item = posts.get(route.wpSlug);
      if (!item) {
        console.warn(`  MISSING post slug "${route.wpSlug}" for route /${route.slug}/`);
        manifest.push({ route: route.slug, status: "todo", sourceUrl: null, words: 0, images: 0 });
        continue;
      }
      const title = cleanText(item.title.rendered);
      const description = cleanText(item.excerpt.rendered.replace(/<[^>]+>/g, "")).slice(0, 160);
      const body = await htmlFragmentToMarkdown(item.content.rendered, route.slug, images);
      const todoNote = route.kind === "post-provisional" ? `\nTODO(content): ${route.note}\n` : "";
      const fm = frontmatter({
        title,
        description,
        sourceUrl: item.link,
        date: item.date,
        extractedAt: new Date().toISOString(),
        locale: "fr",
        status: route.kind === "post-provisional" ? "provisional" : "ok",
      });
      await writeRoute(route.slug, fm + todoNote + body + "\n");
      manifest.push({
        route: route.slug,
        status: route.kind === "post-provisional" ? "provisional" : "ok",
        sourceUrl: item.link,
        words: body.split(/\s+/).filter(Boolean).length,
        images: (body.match(/!\[/g) ?? []).length,
      });
    }
  }

  // News index: every post not already claimed above (agency announcements, the campaign page).
  const claimedWpSlugs = new Set(
    ROUTES.filter((r): r is Extract<Route, { kind: "post" | "post-provisional" }> =>
      r.kind === "post" || r.kind === "post-provisional",
    ).map((r) => r.wpSlug),
  );
  for (const [wpSlug, item] of posts) {
    if (claimedWpSlugs.has(wpSlug)) continue;
    await sleep(150);
    const routeSlug = `actualites/${NEWS_SLUG_OVERRIDES[wpSlug] ?? wpSlug}`;
    const title = cleanText(item.title.rendered);
    const description = cleanText(item.excerpt.rendered.replace(/<[^>]+>/g, "")).slice(0, 160);
    const body = await htmlFragmentToMarkdown(item.content.rendered, routeSlug, images);
    const fm = frontmatter({
      title,
      description,
      sourceUrl: item.link,
      date: item.date,
      extractedAt: new Date().toISOString(),
      locale: "fr",
      status: "ok",
    });
    await writeRoute(routeSlug, fm + body + "\n");
    manifest.push({
      route: routeSlug,
      status: "ok",
      sourceUrl: item.link,
      words: body.split(/\s+/).filter(Boolean).length,
      images: (body.match(/!\[/g) ?? []).length,
    });
  }

  // actualites/ hub itself: the live /blog/ archive is pure template chrome (post grid),
  // pagination is composed in WP6 — there is no unique static copy to extract.
  await writeRoute(
    "actualites",
    frontmatter({
      title: "Actualités",
      sourceUrl: `${SITE}/blog/`,
      extractedAt: new Date().toISOString(),
      locale: "fr",
      status: "ok",
    }) +
      "No unique static copy on the live archive beyond the post grid itself; the index page is " +
      "composed from the news collection in WP6, not extracted content.\n",
  );
  manifest.push({ route: "actualites", status: "ok", sourceUrl: `${SITE}/blog/`, words: 0, images: 0 });

  // Live pages that exist but aren't in the BUILD-PLAN.md §5 route map, surfaced for a human
  // decision rather than silently extracted or silently dropped.
  const mappedWpSlugs = new Set(
    ROUTES.filter((r): r is Extract<Route, { kind: "page" }> => r.kind === "page").map((r) => r.wpSlug),
  );
  const hubWpSlugs = new Set(
    ROUTES.filter((r): r is Extract<Route, { kind: "hub-section" }> => r.kind === "hub-section").map(
      (r) => r.hubWpSlug,
    ),
  );
  const THEME_DEMO_SLUGS = new Set([
    "page-d-exemple", "my-account", "checkout", "cart", "shop", "services-with-icon",
    "portfolio-carousel", "portfolio-masonry", "portfolio-grid", "single-team", "our-team",
    "elements", "coming-soon", "404-2", "faqs", "our-core-values", "typography",
    "finance-planning", "support-function", "project-management", "business-consulting",
    "organizational-audit", "marketing-research",
  ]);
  const unmapped = [...pages.values()].filter(
    (p) =>
      !mappedWpSlugs.has(p.slug) &&
      !hubWpSlugs.has(p.slug) &&
      !THEME_DEMO_SLUGS.has(p.slug) &&
      p.slug !== "blog", // sourced intentionally for /actualites/, just not via the "page" route kind
  );

  const manifestMd = [
    "# WP1 extraction manifest",
    "",
    `Generated ${new Date().toISOString()} from ${SITE}. Re-run with \`npm run extract:content\`.`,
    "",
    "| Route | Status | Words | Images | Source |",
    "|---|---|---|---|---|",
    ...manifest
      .sort((a, b) => a.route.localeCompare(b.route))
      .map(
        (m) =>
          `| /${m.route}/`.replace("//", "/") +
          ` | ${m.status} | ${m.words} | ${m.images} | ${m.sourceUrl ? `[link](${m.sourceUrl})` : "—"} |`,
      ),
    "",
    "## Live pages found but not in BUILD-PLAN.md §5 (not extracted — needs a human call)",
    "",
    unmapped.length === 0
      ? "None."
      : unmapped.map((p) => `- \`${p.slug}\` → ${p.link}`).join("\n") +
        "\n\nReal pages, not theme demo content, but not part of the agreed §5 route map. " +
        "Flagging for a decision on whether they belong in the rebuild.",
    "",
  ].join("\n");
  await writeFile(join(OUT_DIR, "MANIFEST.md"), manifestMd, "utf8");

  const todoCount = manifest.filter((m) => m.status !== "ok").length;
  console.log(`Done. ${manifest.length} routes written, ${todoCount} need human follow-up.`);
  console.log(`See ${join(OUT_DIR, "MANIFEST.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
