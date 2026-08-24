/**
 * Account-type options for the "Ouvrir un compte" form. Verbatim from the live Elementor form's
 * own values, including its redundancy between "COMPTES À TERME" and the two more specific
 * "terme" options (content-extracted/fr/ouvrir-un-compte.md — BUILD-PLAN.md §0: never invent
 * financial content).
 *
 * Shared between src/pages/ouvrir-un-compte/index.astro (renders the <select> options) and
 * worker/lib/validate.ts (REMEDIATION-PLAN.md PR3 — the Worker re-validates that a submitted
 * `accountType` is one of these exact values server-side, since the client-side <select> is
 * trivial to bypass with a direct POST) — one list, so the two can't drift apart.
 */
export const accountTypeOptions = [
  "COMPTES DE DÉPÔTS",
  "COMPTES COURANTS PARTICULIER NON SALARIÉ",
  "COMPTES COURANTS SALARIÉS (PUBLIC / PRIVÉ)",
  "COMPTES ORGANISATIONS",
  "COMPTES ENTREPRISES (ÉTABLISSEMENT / SARL / S.A)",
  "COMPTES À TERME",
  "DEPOT A TERME",
  "BONS DE CAISSE",
] as const;
