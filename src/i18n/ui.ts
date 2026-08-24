export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const ui = {
  fr: {
    "skip.toMainContent": "Aller au contenu principal",
    "site.name": "Oris Finance",
    "nav.home": "Accueil",
    "nav.toggle": "Menu",
    "lang.fr": "Français",
    "lang.en": "English",
    "footer.hqLabel": "Siège social",
    "footer.rights": "Tous droits réservés.",
  },
  en: {
    "skip.toMainContent": "Skip to main content",
    "site.name": "Oris Finance",
    "nav.home": "Home",
    "nav.toggle": "Menu",
    "lang.fr": "Français",
    "lang.en": "English",
    "footer.hqLabel": "Head office",
    "footer.rights": "All rights reserved.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type UiKey = keyof (typeof ui)[typeof defaultLocale];

/**
 * Nav items live here, not hardcoded in Header.astro, so WP4+ appends real routes without
 * touching the component. `path` is locale-root-relative (no locale prefix) — same convention
 * Base.astro's `path` prop uses. Only the homepage exists today; nothing else has a route yet.
 */
export interface NavItem {
  labelKey: UiKey;
  path: string;
}

export const navItems: NavItem[] = [{ labelKey: "nav.home", path: "/" }];

/**
 * HQ contact facts, verified against content-extracted/fr/contacts.md — the single source
 * Header, Footer, and Base.astro's Organization JSON-LD all read from, so the three never
 * drift. Locale-agnostic (an address/phone isn't translated), same reasoning BUILD-PLAN.md §4
 * applies to the `agencies` content collection.
 */
export const hq = {
  legalName: "Oris finance S.A",
  streetAddress: "Douala Akwa Ancien Afrique construction, Face Station MRS",
  locality: "Douala",
  countryCode: "CM",
  phoneDisplay: "+237 233 430 880",
  phoneE164: "+237233430880",
  email: "contact@oris-finance.com",
} as const;
