# Architecture Actuelle - Bizness Action

## Vue d'ensemble Technique
- **Frontend / Backend** : Next.js (App Router, Server Actions)
- **Base de données** : PostgreSQL
- **ORM** : Prisma
- **Stockage Fichiers** : Supabase Storage (cartes grises, devis)
- **Emails** : Resend
- **Hébergement** : Vercel

## Cartographie des Composants

```text
bizness-action/
├── prisma/
│   └── schema.prisma         # Définition de la BDD
├── src/
│   ├── app/
│   │   ├── actions/          # Logique métier (Server Actions)
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   ├── client.ts
│   │   │   ├── dossier.ts
│   │   │   └── suivi.ts
│   │   ├── admin/            # Dashboard Admin
│   │   ├── demande-devis/    # Formulaire public
│   │   ├── espace-client/    # Espace connecté
│   │   └── suivi/            # Suivi public sans compte
│   └── lib/
│       └── prisma.ts         # Singleton Prisma
```

## Workflows Implémentés
1. **Demande de Devis (Dossier)**
   - Soumission avec ou sans compte (basé sur le téléphone).
   - Upload des documents sur Supabase.
   - Création de l'entité `Dossier`.
2. **Traitement Admin**
   - Upload d'un fichier "devis".
   - Passage du statut à `OFFRE_ENVOYEE`.
   - Notification email envoyée via Resend.
3. **Espace Client & Transactions**
   - Consultation des dossiers.
   - Consultation des transactions financières ajoutées par l'admin.
   - Validation requise si une transaction est modifiée après 5 minutes (`isModificationPending`).
