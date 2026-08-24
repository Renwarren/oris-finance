import type { APIRoute } from "astro";
import { defaultLocale, locales, type Locale } from "../i18n/ui";
import { localePath } from "../i18n/utils";

interface SitemapEntry {
  /** Locale-root-relative path, same convention as Base.astro's `path` prop. */
  path: string;
  /** Present when this URL has an equivalent in other locales — maps locale to its own
   *  locale-relative path. Absent = no <xhtml:link> alternates for this URL, matching
   *  Base.astro's own graceful-degradation rule for translatedPath. */
  alternates?: Partial<Record<Locale, string>>;
}

// Today: only the WP3 smoke-test homepage exists in each locale. WP4+ extends this array by
// mapping getCollection() results into the same SitemapEntry shape before the render step
// below — the render loop itself doesn't need to change.
const entries: SitemapEntry[] = [{ path: "/", alternates: { fr: "/", en: "/" } }];

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = site as URL;

  const urls = entries.flatMap((entry) =>
    locales.map((locale) => {
      const loc = new URL(localePath(locale, entry.path), base).toString();
      const alternateLinks = entry.alternates
        ? Object.entries(entry.alternates)
            .map(([altLocale, altPath]) => {
              const href = new URL(localePath(altLocale as Locale, altPath as string), base).toString();
              return `<xhtml:link rel="alternate" hreflang="${altLocale}" href="${href}" />`;
            })
            .concat(
              (() => {
                const xDefaultPath = entry.alternates?.[defaultLocale] ?? entry.path;
                const href = new URL(localePath(defaultLocale, xDefaultPath), base).toString();
                return `<xhtml:link rel="alternate" hreflang="x-default" href="${href}" />`;
              })(),
            )
            .join("")
        : "";
      return `<url><loc>${loc}</loc>${alternateLinks}</url>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
