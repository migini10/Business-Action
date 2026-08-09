# Dette Technique et Problèmes d'Architecture

## 1. Anomalies Financières et Comptables (P0)
- **Calcul du Solde (FIN-001)** : La somme des transactions (`+ PAIEMENT` et `+ CREANCE`) fausse totalement la balance du client. Les dettes et les règlements doivent s'opposer.
- **Modification Destructive (FIN-002)** : L'écrasement pur et simple des montants lors d'une mise à jour de transaction détruit la piste d'audit financière.
- **Absence d'Affectation (FIN-003)** : Un paiement n'est pas lié à une créance ou un dossier spécifique. Impossible de savoir "quoi a été payé par ce versement".

## 2. Modèle de Données (P1)
- **Confusion Devis / Contrat (ARCH-001)** : Il n'existe pas d'entité `InsuranceContract` (ou équivalent). Le modèle `Dossier` gère la demande de devis (`statut = EN_ATTENTE`, `OFFRE_ENVOYEE`) mais ne se transforme jamais en contrat pérenne avec dates de début/fin, partenaire assureur, etc.
- **Échéances isolées (ARCH-002)** : L'entité `Echeance` existe, mais sans notification cron ni suivi clair lié à un contrat (puisqu'il n'y a pas de contrat, juste un `Dossier`).

## 3. Scripts de Maintenance Dangereux (P1)
- **`fix_creances.ts` & `fix_dossiers.ts`** : Ces scripts sont créés pour corriger des erreurs de conception (dossiers orphelins, montants négatifs saisis par erreur) en modifiant directement la production. Cela indique un manque de validation stricte à l'entrée (Zod/Joi) dans les Server Actions.
- **`clear_db.ts`** : Présent dans le repo avec un `deleteMany` global. S'il venait à être exécuté par inadvertance en production, cela causerait une perte totale de données. (À supprimer ou isoler strictement à l'environnement de dev/test).

## 4. Sécurité et Autorisations (P2)
- **Validation d'Entrée (SEC-001)** : Les Server Actions (ex: `dossier.ts`, `admin.ts`) font confiance aux entrées (`formData.get('typeVehicule') as string`) sans librairie de schéma robuste. Risque d'incohérence de données (mass assignment, mauvaises valeurs de statuts).
- **Contrôle d'Accès (AUTH-001)** : Il faut s'assurer que les Server Actions vérifient rigoureusement le rôle de l'utilisateur appelant (middleware ou check en début de fonction). L'audit statique rapide ne montre pas de vérification de session stricte dans les fonctions serveur exportées (ex: `updateDossierStatus`).

## 5. Qualité et Tests (P2)
- **Absence de Tests (TEST-001)** : Aucun framework de test unitaire (Jest, Vitest) ou E2E (Cypress, Playwright) n'est configuré. Les flux critiques financiers ne sont pas protégés contre la régression.
- **Variables non typées (CODE-001)** : Utilisation de `any` dans certains catch blocks ou types complexes.
