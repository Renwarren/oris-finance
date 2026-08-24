export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const ui = {
  fr: {
    "skip.toMainContent": "Aller au contenu principal",
    "site.name": "Oris Finance",
    "nav.home": "Accueil",
    "nav.accounts": "Nos comptes",
    "nav.products": "Nos produits",
    "nav.agencies": "Nos agences",
    "nav.news": "Actualités",
    "nav.contact": "Contact",
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
    "nav.accounts": "Accounts",
    "nav.products": "Products",
    "nav.agencies": "Branches",
    "nav.news": "News",
    "nav.contact": "Contact",
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
 * Base.astro's `path` prop uses. Every fr route below exists; none has an English twin yet
 * (BUILD-PLAN.md: "French is the source of truth; English is a translation").
 *
 * `locales` records which locales `path` actually resolves in. Header.astro filters navItems
 * against the current locale before rendering, so an item stays out of the nav entirely until
 * its route is built for that locale — instead of every item being pushed blindly through
 * `localePath()` and emitting a 404 on locales it hasn't been built for yet (REMEDIATION-
 * PLAN.md PR 2). Data-driven on purpose: adding an English route later means adding "en" here,
 * not touching Header.astro.
 */
export interface NavItem {
  labelKey: UiKey;
  path: string;
  locales: readonly Locale[];
}

export const navItems: NavItem[] = [
  { labelKey: "nav.accounts", path: "/nos-comptes/", locales: ["fr"] },
  { labelKey: "nav.products", path: "/nos-produits/", locales: ["fr"] },
  { labelKey: "nav.agencies", path: "/agences/", locales: ["fr"] },
  { labelKey: "nav.news", path: "/actualites/", locales: ["fr"] },
  { labelKey: "nav.contact", path: "/contacts/", locales: ["fr"] },
];

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
