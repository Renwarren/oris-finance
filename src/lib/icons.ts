/**
 * Icon assignment for account categories and product families (REMEDIATION-PLAN.md PR4 /
 * BUILD-PLAN.md §7). Centralised so every template that needs a category/family icon reads the
 * same mapping instead of re-declaring it. All names are Phosphor's bare (Regular) weight —
 * picked once and used everywhere, per §7's "pick one weight and stay on it."
 */

/** Keys match the `category` enum in src/content.config.ts (accounts collection). */
export const accountCategoryIcons: Record<
  "depots" | "organisations" | "courants" | "entreprises" | "terme",
  string
> = {
  depots: "ph:piggy-bank",
  organisations: "ph:users-three",
  courants: "ph:wallet",
  entreprises: "ph:buildings",
  terme: "ph:vault",
};

/** Keyed by product entry slug (`entry.id` with the `fr/` prefix stripped) — the products
 *  schema (src/content.config.ts) has no discrete "family" field, just the document id. */
export const productFamilyIcons: Record<string, string> = {
  "banque-a-distance": "ph:device-mobile",
  bancassurance: "ph:shield-check",
  "transfert-et-change": "ph:arrows-left-right",
};
