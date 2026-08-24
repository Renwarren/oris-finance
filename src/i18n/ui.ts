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
 */
export interface NavItem {
  labelKey: UiKey;
  path: string;
}

export const navItems: NavItem[] = [
  { labelKey: "nav.accounts", path: "/nos-comptes/" },
  { labelKey: "nav.products", path: "/nos-produits/" },
  { labelKey: "nav.agencies", path: "/agences/" },
  { labelKey: "nav.news", path: "/actualites/" },
  { labelKey: "nav.contact", path: "/contacts/" },
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
  /**
   * Head-office hours, verbatim from content-extracted/fr/contacts.md ("Horaires: Lun - Ven :
   * 8h00 - 17h00 Samedi: 8h00 - 17h00 Dimanche: Pas ouvert !"). Single source for Footer.astro,
   * /contacts/, and the Akwa branch's LocalBusiness JSON-LD (src/pages/agences/[slug].astro,
   * gated on that branch's `isHeadOffice` flag in src/content.config.ts) — same "so the three
   * never drift" reasoning as the rest of `hq`. No other branch has verified hours in
   * content-extracted/; see REMEDIATION-PLAN.md decision D6 before adding any.
   */
  hours: {
    display: [
      { days: "Lun – Ven", range: "8h00 – 17h00" },
      { days: "Samedi", range: "8h00 – 17h00" },
      { days: "Dimanche", range: "Fermé" },
    ],
    // schema.org's `openingHours` shorthand: two-letter day range + 24h HH:MM-HH:MM (schema.org/
    // LocalBusiness). Sunday is omitted rather than written as closed — an absent day means
    // closed, per schema.org convention — so only the two open ranges are listed.
    schemaOrg: ["Mo-Fr 08:00-17:00", "Sa 08:00-17:00"],
  },
} as const;
