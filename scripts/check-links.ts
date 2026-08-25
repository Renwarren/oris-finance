/**
 * REMEDIATION-PLAN.md PR 2: walks `dist/` after a production build and fails if any internal
 * `<a href>` points at a route with no corresponding file — the class of bug that shipped five
 * dead `/en/...` nav links (Header.astro pushing every navItem through localePath() regardless
 * of whether that locale's route existed) and a dead `/a-propos/` link in the homepage hero.
 * Without this, a route can be renamed or dropped and nothing catches the links left pointing at
 * it until a human clicks through, or worse, a customer does.
 *
 * A link counts as resolved if either:
 *   - it matches a file in dist/ (an exact file, `<path>/index.html`, or `<path>.html`), or
 *   - its source path is a 301 source in `public/_redirects` (WP7) — the link is intentionally
 *     redirected elsewhere at request time, not dead.
 * External links, `mailto:`, `tel:`, `javascript:`, and same-page `#anchor` links are ignored;
 * this checker is only about internal navigation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const DIST_DIR = resolve(import.meta.dirname, "..", "dist");
const REDIRECTS_PATH = resolve(DIST_DIR, "_redirects");

interface BrokenLink {
  route: string;
  href: string;
}

interface RouteReport {
  route: string;
  htmlPath: string;
  linkCount: number;
  broken: BrokenLink[];
}

function findHtmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function toRoute(htmlPath: string): string {
  const rel = posix.relative(DIST_DIR.replaceAll("\\", "/"), htmlPath.replaceAll("\\", "/"));
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}

/** Every `href="..."` inside an `<a ...>` tag, in document order, attribute-order independent —
 *  same two-pass approach as check-budget.ts's extractAttrUrls. */
function extractAnchorHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const hrefPattern = /href="([^"]*)"/i;
  for (const tagMatch of html.matchAll(/<a\s+[^>]*>/gi)) {
    const hrefMatch = hrefPattern.exec(tagMatch[0]);
    if (hrefMatch) hrefs.push(hrefMatch[1]);
  }
  return hrefs;
}

function isExternal(url: string): boolean {
  return (
    /^([a-z]+:)?\/\//i.test(url) ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("javascript:")
  );
}

/** Parses public/_redirects (copied verbatim into dist/ by Astro): whitespace-separated
 *  `source target code` lines, `#`-comments and blank lines skipped. Only the source column
 *  matters here — a link to a 301 source is intentionally redirected, not dead. */
function loadRedirectSources(): Set<string> {
  const sources = new Set<string>();
  let text: string;
  try {
    text = readFileSync(REDIRECTS_PATH, "utf-8");
  } catch {
    return sources;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [source] = trimmed.split(/\s+/);
    if (source) sources.add(source);
  }
  return sources;
}

/** True if `pathname` (root-relative, e.g. "/agences/douala/") resolves to a file dist/ would
 *  actually serve. */
function fileExistsForPath(pathname: string): boolean {
  const trimmed = pathname.replace(/^\/+/, "");
  const candidates = trimmed.endsWith("/") || trimmed === ""
    ? [join(DIST_DIR, trimmed, "index.html")]
    : [join(DIST_DIR, trimmed), join(DIST_DIR, trimmed, "index.html"), join(DIST_DIR, `${trimmed}.html`)];
  return candidates.some((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

/** Resolves an `<a href>` value against the HTML file it appeared in. Returns null for anything
 *  out of scope for this checker (external, mailto:, tel:, javascript:, same-page anchor). */
function resolvePathname(href: string, fromHtmlPath: string): string | null {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || isExternal(href)) return null;
  if (clean.startsWith("/")) return clean;
  // Relative href: resolve against the route directory the linking page lives in.
  const routeDir = posix.dirname(toRoute(fromHtmlPath));
  return posix.join(routeDir, clean);
}

function analyzeRoute(htmlPath: string, redirectSources: Set<string>): RouteReport {
  const html = readFileSync(htmlPath, "utf-8");
  const route = toRoute(htmlPath);
  const hrefs = extractAnchorHrefs(html);

  let linkCount = 0;
  const broken: BrokenLink[] = [];
  for (const href of hrefs) {
    const pathname = resolvePathname(href, htmlPath);
    if (pathname === null) continue;
    linkCount++;
    if (fileExistsForPath(pathname) || redirectSources.has(pathname)) continue;
    broken.push({ route, href });
  }

  return { route, htmlPath, linkCount, broken };
}

function main() {
  let htmlFiles: string[];
  try {
    htmlFiles = findHtmlFiles(DIST_DIR);
  } catch {
    console.error(`dist/ not found at ${DIST_DIR} — run \`npm run build\` first.`);
    process.exit(1);
  }

  const redirectSources = loadRedirectSources();
  const reports = htmlFiles
    .map((htmlPath) => analyzeRoute(htmlPath, redirectSources))
    .sort((a, b) => a.route.localeCompare(b.route));

  console.log(`Checking internal links across ${reports.length} route(s) in dist/\n`);
  console.log("Route".padEnd(70) + "Links".padStart(8) + "Broken".padStart(9));
  for (const r of reports) {
    console.log(
      `${r.route.padEnd(70)}${String(r.linkCount).padStart(8)}${String(r.broken.length).padStart(9)}${r.broken.length > 0 ? "  BROKEN" : ""}`,
    );
  }

  const allBroken = reports.flatMap((r) => r.broken);
  if (allBroken.length > 0) {
    console.error(`\n${allBroken.length} dead internal link(s):\n`);
    for (const b of allBroken) {
      console.error(`  ${b.route}  ->  ${b.href}`);
    }
    process.exit(1);
  }

  console.log(`\nAll internal links across ${reports.length} routes resolve.`);
}

main();
