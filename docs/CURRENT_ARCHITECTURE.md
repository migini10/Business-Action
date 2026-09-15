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
4. **Contrats d'Assurance, Rappels & Attestations Sécurisées (Phase 1)**
   - **Deux modes d'entrée exclusifs** :
     - *Mode Automatique* : upload contrat/attestation -> OCR/IA extrait les informations -> correction possible -> validation humaine obligatoire.
     - *Mode Manuel* : saisie directe sans OCR, attestation rattachée lorsqu'elle est disponible.
     - Les deux modes alimentent le même modèle métier (`InsuranceContract`).
   - **Moteur pur de rappels d'expiration** :
     - Exactement deux rappels WhatsApp : **J-7** et **J-2** à 08:00 heure de Dakar (`Africa/Dakar`, UTC+0).
     - Création entre J-7 et J-2 (ex: J-5) : uniquement J-2 planifié.
     - Création après J-2 : aucun rappel planifié.
     - Modification de date : annulation des anciens rappels `PREVU` et recalcul.
     - Renouvellement : clôture de l'ancienne période (`RENOUVELE`), conservation d'historique, annulation des anciens rappels, création du nouveau contrat (`previousContractId`) et nouveaux rappels.
   - **Attestation disponible & Jetons de téléchargement sécurisés** :
     - Distribution WhatsApp : PNG affiché directement + lien sécurisé de téléchargement PDF sans connexion.
     - Sécurité cryptographique : jeton CSPRNG >= 256 bits (`randomBytes(32).toString('base64url')`), stockage uniquement de l'empreinte SHA-256 (`tokenHash`), aucun identifiant sensible dans l'URL.
     - Validité du jeton : exactement jusqu'à la date/heure d'expiration de l'attestation (`expiresAt = attestation.dateExpiration`).
     - Révocation : immédiate si attestation annulée, révoquée ou remplacée.
     - Règle stricte : Aucun jeton généré sans attestation PDF réellement disponible et validée.
