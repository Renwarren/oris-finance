---
title: "Ouvrir un compte"
description: "Formulaire d'ouverture de compte en ligne — Oris Finance S.A"
sourceUrl: "https://oris-finance.com/ouvrir-un-compte/"
extractedAt: "2026-08-24T16:00:00.000Z"
locale: "fr"
status: "ok"
---

Agrément N° 0000 780/MINFI du 30 octobre 2024 portant agrément de l’organisation d’intermédiation
spécialisée en finance inclusive (ORIS FINANCE SA), établissement de microfinance de 2ème
catégorie.

### Qui peut ouvrir un compte

Toute personne physique ou toute association formelle ou non formelle.

### Avantages

- Différents types de comptes en fonction du besoin
- Gestionnaire dédié
- Collecte mobile possible au lieu d’activité/domicile
- Différents canaux alternatifs

### Formulaire (Elementor form, name="Ouverture de compte", post_id 2328)

Extracted from field markup, not the WordPress plugin itself (CLAUDE.md: never copy anything
executable from the live install) — labels/placeholders only.

- Nom Complet — text, required, placeholder "Votre nom Complet"
- Email — email, required, placeholder "Adresse email"
- Numéro de téléphone — tel, required, placeholder "Insérer numéro de téléphone"
- Numéro WhatsApp — tel, required, placeholder "Insérer votre numero whatsapp"
- Montant initial à verser — text, required
- Sélectionner un compte — select, required. Options (verbatim, including the source's own
  redundancy between "COMPTES À TERME" and the two more specific terme options below it):
  - COMPTES DE DÉPÔTS
  - COMPTES COURANTS PARTICULIER NON SALARIÉ
  - COMPTES COURANTS SALARIÉS (PUBLIC / PRIVÉ)
  - COMPTES ORGANISATIONS
  - COMPTES ENTREPRISES (ÉTABLISSEMENT / SARL / S.A)
  - COMPTES À TERME
  - DEPOT A TERME
  - BONS DE CAISSE
- Ville — text, required, placeholder "Insérer Ville"
- Quartier — text, required, placeholder "Insérer Quartier"
- Message — textarea, optional, placeholder "Donner nous plus d’informations svp"
- Pièce jointe — file upload, optional, max 5 MB (no accepted-types restriction seen in markup)
- Consentement — checkbox, required: "En cliquant sur « Envoyer », vous autorisez ORIS FINANCE
  S.A à vous contacter et à utiliser vos données personnelles pour des fins commerciales."
  TODO(content): the live checkbox ships pre-checked (`checked="checked"`) — an opt-out default
  for a marketing-data-use consent. The rebuild leaves it unchecked by default; flag this
  decision for the repo owner rather than silently reproducing it.
- Submit button label: "Envoyer"

TODO(content): the live page's own contact block gives `siege@oris-finance.com`, which doesn't
match `hq.email` (`contact@oris-finance.com`) already used sitewide — the same discrepancy
WP1 flagged for `content-extracted/fr/contacts.md`. Not resolved here; using the sitewide
`hq.email` for consistency until the repo owner confirms which is canonical.

No fees, interest rates, or minimum-deposit figures are stated anywhere on this page.
