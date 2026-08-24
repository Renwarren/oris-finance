import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { defaultLocale, type Locale } from "../i18n/ui";
import { localePath } from "../i18n/utils";

interface SitemapEntry {
  /** Locale-root-relative path, same convention as Base.astro's `path` prop. */
  path: string;
  /** Which locale(s) this URL actually has a page for, mapped to that locale's own
   *  locale-relative path. A single-key map (the common case today — no route past the WP3
   *  homepage has an English twin yet) emits no <xhtml:link> alternates, matching Base.astro's
   *  own graceful-degradation rule for a missing translatedPath. */
  locales: Partial<Record<Locale, string>>;
}

const fr = (path: string): SitemapEntry => ({ path, locales: { fr: path } });

const accounts = await getCollection("accounts", (entry) => entry.data.locale === "fr");
const products = await getCollection("products", (entry) => entry.data.locale === "fr");
const agencies = await getCollection("agencies");
const news = await getCollection("news", (entry) => entry.data.locale === "fr");

const NEWS_PAGE_SIZE = 9;
const newsPageCount = Math.max(1, Math.ceil((news.length - 1) / NEWS_PAGE_SIZE)); // -1: featured post is pinned, not paginated

// WP4+ extends this array by mapping getCollection() results into SitemapEntry — the render
// step below doesn't change as more collections/routes are added.
const entries: SitemapEntry[] = [
  { path: "/", locales: { fr: "/", en: "/" } },
  fr("/nos-comptes/"),
  ...accounts.map((entry) => fr(`/nos-comptes/${entry.id.replace(/^fr\//, "")}/`)),
  fr("/nos-produits/"),
  ...products.map((entry) => fr(`/nos-produits/${entry.id.replace(/^fr\//, "")}/`)),
  fr("/agences/"),
  ...agencies.map((entry) => fr(`/agences/${entry.id}/`)),
  fr("/actualites/"),
  ...Array.from({ length: newsPageCount - 1 }, (_, i) => fr(`/actualites/${i + 2}/`)),
  ...news.map((entry) => fr(`/actualites/${entry.id.replace(/^fr\//, "")}/`)),
  fr("/contacts/"),
];

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = site as URL;

  const urls = entries.flatMap((entry) => {
    const localeList = Object.keys(entry.locales) as Locale[];
    return localeList.map((locale) => {
      const loc = new URL(localePath(locale, entry.locales[locale]!), base).toString();
      const alternateLinks =
        localeList.length > 1
          ? localeList
              .map((altLocale) => {
                const href = new URL(localePath(altLocale, entry.locales[altLocale]!), base).toString();
                return `<xhtml:link rel="alternate" hreflang="${altLocale}" href="${href}" />`;
              })
              .concat(
                (() => {
                  const href = new URL(
                    localePath(defaultLocale, entry.locales[defaultLocale] ?? entry.path),
                    base,
                  ).toString();
                  return `<xhtml:link rel="alternate" hreflang="x-default" href="${href}" />`;
                })(),
              )
              .join("")
          : "";
      return `<url><loc>${loc}</loc>${alternateLinks}</url>`;
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
