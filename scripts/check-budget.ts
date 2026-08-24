/**
 * WP8 (BUILD-PLAN.md §8): walks `dist/` after a production build and fails the build if any
 * route exceeds the performance budget from BUILD-PLAN.md's header — ≤600 KB / ≤35 requests.
 * Without this the site drifts back toward the 4.2 MB / 129-request state of the live WordPress
 * install (BUILD-PLAN.md §1) one "just one more image" at a time.
 *
 * Per route, a "request" is: the HTML document itself, plus every distinct local resource a
 * browser would actually fetch to render it — <link rel=stylesheet>, <script src>, <img
 * src/srcset>, <link rel=preload|icon>, and any @font-face `url(...)` inside a linked
 * stylesheet (fonts aren't visible in the HTML directly, so linked CSS files are parsed too).
 * Sizes are read straight off disk in `dist/` — uncompressed — because that's what a CI check
 * can measure deterministically without spinning up a server; it's a stricter number than
 * gzip/brotli-over-the-wire, which only helps the budget.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const DIST_DIR = resolve(import.meta.dirname, "..", "dist");
const MAX_BYTES = 600 * 1024;
const MAX_REQUESTS = 35;

// Internal reference/dev pages that aren't part of the shipped route map (BUILD-PLAN.md §5) —
// not subject to the user-facing performance budget. `/tokens/` was here until REMEDIATION-PLAN.md
// PR10 gated it behind `import.meta.env.DEV`, so it no longer builds in production at all.
const EXEMPT_ROUTES = new Set<string>([]);

interface RouteReport {
  route: string;
  htmlPath: string;
  totalBytes: number;
  requestCount: number;
  resources: string[];
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

/** Strips query/hash and resolves a root-relative or relative URL against dist/. Returns null
 *  for anything not servable from this build (external URLs, mailto:, tel:, data:). */
function resolveLocalAsset(url: string, fromHtmlPath: string): string | null {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || /^([a-z]+:)?\/\//i.test(clean) || clean.startsWith("data:") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
    return null;
  }
  const diskPath = clean.startsWith("/")
    ? join(DIST_DIR, clean)
    : join(fromHtmlPath, "..", clean);
  try {
    statSync(diskPath);
    return diskPath;
  } catch {
    return null;
  }
}

function extractAttrUrls(html: string, tagPattern: RegExp, attr: "href" | "src"): string[] {
  const urls: string[] = [];
  const attrPattern = new RegExp(`${attr}="([^"]+)"`, "i");
  for (const tagMatch of html.matchAll(tagPattern)) {
    const attrMatch = attrPattern.exec(tagMatch[0]);
    if (attrMatch) urls.push(attrMatch[1]);
  }
  return urls;
}

function extractSrcsetUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/srcset="([^"]+)"/gi)) {
    for (const candidate of match[1].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) urls.push(url);
    }
  }
  return urls;
}

/** @font-face src inside a linked CSS file — fonts never appear as `<link>`/`<img>` tags, so
 *  they're invisible unless we look inside the one CSS file every route links. */
function extractFontUrlsFromCss(cssPath: string): string[] {
  const css = readFileSync(cssPath, "utf-8");
  const urls: string[] = [];
  for (const match of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/gi)) {
    urls.push(match[1]);
  }
  return urls;
}

function analyzeRoute(htmlPath: string): RouteReport {
  const html = readFileSync(htmlPath, "utf-8");
  const route = toRoute(htmlPath);

  const candidateUrls = [
    ...extractAttrUrls(html, /<link\s+[^>]*rel="(?:stylesheet|preload|icon|shortcut icon)"[^>]*>/gi, "href"),
    ...extractAttrUrls(html, /<script\s+[^>]*src="[^"]*"[^>]*>/gi, "src"),
    ...extractAttrUrls(html, /<img\s+[^>]*src="[^"]*"[^>]*>/gi, "src"),
    ...extractSrcsetUrls(html),
  ];

  const resourcePaths = new Set<string>();
  for (const url of candidateUrls) {
    const resolved = resolveLocalAsset(url, htmlPath);
    if (resolved) resourcePaths.add(resolved);
  }

  // Follow linked stylesheets one level deep to pick up @font-face files.
  for (const url of extractAttrUrls(html, /<link\s+[^>]*rel="stylesheet"[^>]*>/gi, "href")) {
    const cssPath = resolveLocalAsset(url, htmlPath);
    if (!cssPath) continue;
    for (const fontUrl of extractFontUrlsFromCss(cssPath)) {
      const resolved = resolveLocalAsset(fontUrl, cssPath);
      if (resolved) resourcePaths.add(resolved);
    }
  }

  const htmlBytes = statSync(htmlPath).size;
  let totalBytes = htmlBytes;
  for (const path of resourcePaths) {
    totalBytes += statSync(path).size;
  }

  return {
    route,
    htmlPath,
    totalBytes,
    requestCount: 1 + resourcePaths.size,
    resources: [...resourcePaths],
  };
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  let htmlFiles: string[];
  try {
    htmlFiles = findHtmlFiles(DIST_DIR);
  } catch {
    console.error(`dist/ not found at ${DIST_DIR} — run \`npm run build\` first.`);
    process.exit(1);
  }

  const reports = htmlFiles.map(analyzeRoute).sort((a, b) => b.totalBytes - a.totalBytes);
  const failures = reports.filter(
    (r) => !EXEMPT_ROUTES.has(r.route) && (r.totalBytes > MAX_BYTES || r.requestCount > MAX_REQUESTS),
  );

  console.log(`Budget: ${formatKB(MAX_BYTES)} / ${MAX_REQUESTS} requests per route\n`);
  console.log("Route".padEnd(70) + "Size".padStart(10) + "Requests".padStart(11));
  for (const r of reports) {
    const exempt = EXEMPT_ROUTES.has(r.route) ? " (exempt)" : "";
    const over = !EXEMPT_ROUTES.has(r.route) && (r.totalBytes > MAX_BYTES || r.requestCount > MAX_REQUESTS);
    console.log(
      `${(r.route + exempt).padEnd(70)}${formatKB(r.totalBytes).padStart(10)}${String(r.requestCount).padStart(11)}${over ? "  OVER BUDGET" : ""}`,
    );
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} route(s) exceed the budget:\n`);
    for (const r of failures) {
      console.error(`  ${r.route}`);
      if (r.totalBytes > MAX_BYTES) {
        console.error(`    ${formatKB(r.totalBytes)} > ${formatKB(MAX_BYTES)} budget`);
      }
      if (r.requestCount > MAX_REQUESTS) {
        console.error(`    ${r.requestCount} requests > ${MAX_REQUESTS} budget`);
      }
    }
    process.exit(1);
  }

  console.log(`\nAll ${reports.length} routes within budget.`);
}

main();
