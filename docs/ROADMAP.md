# Roadmap d'Évolution

Basé sur l'audit architectural, voici la stratégie recommandée pour sécuriser et faire évoluer la plateforme.

## PHASE 0 — Sécurité / Intégrité Critique (Immédiat)
- **FIN-001** : Corriger d'urgence la formule de calcul des soldes (inverser le signe d'addition ou d'enregistrement entre `CREANCE` et `PAIEMENT`).
- **AUTH-001** : Ajouter la vérification du rôle (Admin) dans toutes les Server Actions sensibles (`updateDossierStatus`, `addTransaction`, `updateTransaction`).
- **SEC-002** : Supprimer ou neutraliser `clear_db.ts` du build de production pour éviter toute catastrophe.

## PHASE 1 — Modélisation Financière Avancée
- Créer un modèle de **Fonds Confiés (ClientFund/Wallet)** pour distinguer un dépôt d'un règlement.
- Implémenter un système d'**Allocation** (lier un `PAIEMENT` à une `CREANCE` spécifique).
- Sécuriser l'historique : au lieu d'écraser une `Transaction` lors d'une modification, générer une écriture d'annulation (contre-passation) et une nouvelle écriture.

## PHASE 2 — Séparation Devis / Contrats d'Assurance
- Introduire l'entité `InsuranceContract` (ou `Police`). 
- Le cycle de vie devient : `Dossier (Devis)` -> validation client -> génération du `InsuranceContract`.
- Lier le contrat à un Partenaire (Compagnie d'assurance) pour un suivi du commissionnement.

## PHASE 3 — Échéances et Alertes Proactives
- Associer les dates d'expiration (`expiresAt`) au nouveau modèle `InsuranceContract`.
- Mettre en place un vrai service Cron (ex: Vercel Cron ou Trigger.dev) pour lire les échéances proches et envoyer les relances via Resend ou WhatsApp.
- Rendre les `Echeance` générées automatiquement payables partiellement.

## PHASE 4 — Fiabilisation et Refactoring
- Intégrer **Zod** pour valider strictement toutes les entrées des Server Actions.
- Mettre en place une suite de tests automatisés (Jest/Vitest) spécifiquement sur le moteur de calcul des soldes et des allocations de paiements.
