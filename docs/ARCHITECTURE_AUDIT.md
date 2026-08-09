# Audit Architectural Complet - Bizness Action

## Contexte
Cet audit fait l'état des lieux du dépôt `bizness-action` (Next.js, Prisma, PostgreSQL). L'application gère les demandes de devis d'assurance automobile, les relations clients, et le suivi financier (créances, dettes, paiements). L'application joue le rôle d'intermédiaire commercial (apporteur d'affaires), et non de compagnie d'assurance.

## Table des Matières
1. [Architecture Courante](./CURRENT_ARCHITECTURE.md)
2. [Modèle du Domaine](./DOMAIN_MODEL.md)
3. [Modèle Financier](./FINANCIAL_MODEL.md)
4. [Invariants Financiers](./FINANCIAL_INVARIANTS.md)
5. [Dette Technique et Risques](./TECHNICAL_DEBT.md)
6. [Roadmap d'Évolution](./ROADMAP.md)

## Résumé Exécutif des Risques

### P0 - CRITIQUE (Intégrité Financière)
Le calcul actuel du solde client additionne toutes les transactions (Paiements, Créances, Dettes) avec une simple valeur absolue, sans respecter les oppositions comptables (Débit/Crédit). Le paiement d'une créance gonfle le solde au lieu de l'annuler. Les modifications écrasent l'historique sans piste d'audit.

### P1 - IMPORTANT (Modélisation Métier)
Le concept de "Contrat d'assurance" n'existe pas dans le modèle de données actuel. Seule la demande initiale (`Dossier`) est représentée. Cela bloque l'implémentation robuste d'un système de relance d'échéances et de suivi des partenaires assureurs.

### P2 - MOYEN (Sécurité et Qualité)
L'absence totale de tests automatisés sur des flux financiers, couplée à la présence de scripts de maintenance manipulant directement les données (ex: `fix_creances.ts`, `clear_db.ts`), expose le système à des instabilités majeures en production.

---
**Note :** Tous les documents détaillés sont disponibles dans le dossier `docs/` de ce dépôt.
