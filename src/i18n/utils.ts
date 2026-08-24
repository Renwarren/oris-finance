import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale, locales, ui, type Locale, type UiKey } from "./ui";

/**
 * Pure function, usable outside component context (e.g. sitemap.xml.ts, future middleware)
 * where `Astro.currentLocale` isn't available. Components should prefer `Astro.currentLocale`
 * (framework-verified against the actually matched route) — this exists as the one place our
 * prefix convention (default locale unprefixed) is encoded for non-component callers.
 */
export function getLocale(url: URL): Locale {
  const [, first] = url.pathname.split("/");
  return (locales as readonly string[]).includes(first) ? (first as Locale) : defaultLocale;
}

export function useTranslations(locale: Locale) {
  return function t(key: UiKey): string {
    return ui[locale][key] ?? ui[defaultLocale][key];
  };
}

/**
 * Thin wrapper around astro:i18n's getRelativeLocaleUrl, not a hand-rolled reimplementation —
 * that helper already correctly encodes prefixDefaultLocale + locale normalization per
 * astro.config.mjs, so re-deriving it by hand would just be a worse, unmaintained copy of
 * framework logic. Kept as a named project function so call sites read as project vocabulary,
 * and to give WP4+ one seam to extend later (e.g. a per-page translated-slug lookup).
 */
export function localePath(locale: Locale, path: string = "/"): string {
  return getRelativeLocaleUrl(locale, path.replace(/^\/+/, ""));
}
