# Invariants Financiers

Ce document liste les principes d'intégrité financière qui **devraient** être respectés par l'application, ainsi que leur état actuel.

### 1. Opposabilité des signes comptables
**Règle :** Un engagement (ex: le client me doit de l'argent) et son règlement (le client me paie) doivent impérativement avoir des signes opposés pour que leur somme s'annule.
**État :** ❌ **VIOLÉ.** Dans `AdminDashboard.tsx`, les `PAIEMENT` et `CREANCE` sont tous deux enregistrés avec un signe positif. Leur somme gonfle artificiellement le solde au lieu de l'équilibrer.

### 2. Préservation de l'historique en cas de modification
**Règle :** Toute modification d'une écriture comptable ou financière doit conserver l'historique (ex: générer une contre-passation ou tracer l'ancienne valeur).
**État :** ❌ **VIOLÉ.** Une transaction modifiée via `updateTransaction` (dans `admin.ts`) écrase l'enregistrement existant. L'historique des modifications n'existe pas.

### 3. Traçabilité des fonds clients (Dépôts vs Paiements)
**Règle :** Il doit être possible de distinguer un dépôt d'argent (fonds en attente d'affectation) d'un règlement ciblant une dette spécifique.
**État :** ❌ **VIOLÉ.** Le système fusionne les deux concepts sous le même type `PAIEMENT`. Aucun mécanisme d'affectation (Allocation) n'existe pour lier un paiement à une créance spécifique.

### 4. Idempotence des opérations
**Règle :** Le système doit garantir qu'une transaction ne peut pas être soumise deux fois accidentellement.
**État :** ❌ **VIOLÉ.** Aucune clé d'idempotence (`idempotency_key`) n'est implémentée. Un double-clic côté client lors de l'appel API risque de créer des transactions en doublon.

### 5. Atomocité (Transactions Base de données)
**Règle :** Les actions impliquant plusieurs modifications (ex: acceptation d'une modification par le client dans `respondToTransactionModification`) devraient être englobées dans des transactions Prisma `$transaction`.
**État :** ❌ **VIOLÉ.** Bien qu'il n'y ait pour le moment qu'un seul `update` par action financière, l'architecture n'anticipe pas l'atomicité pour l'ajout futur d'allocations.
