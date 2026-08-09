# Modèle Financier

## Structure de la base de données
Le suivi financier repose sur l'entité `Transaction`, liée à un `User` (client).

```prisma
model Transaction {
  id          String          @id @default(cuid())
  montant     Float
  type        TypeTransaction // PAIEMENT, DETTE, CREANCE, REMBOURSEMENT
  description String
  commentaire String?
  statut      String          @default("Payé")
  date        DateTime        @default(now())
  clientId    String
}
```

## Fonctionnement Actuel
Les opérations financières hors assurance et liées à l'assurance (Créances, Dettes, Paiements, Remboursements) sont centralisées dans cette table. Le solde du client est calculé en faisant la somme stricte de toutes les transactions :

```typescript
// Extrait de src/app/actions/admin.ts
const solde = user.transactions.reduce((sum, tx) => sum + tx.montant, 0);
```

### Problème Majeur (P0 - INVARIANT VIOLÉ)
Les signes affectés aux transactions lors de la création (dans `AdminDashboard.tsx`) sont les suivants :
- `PAIEMENT` = `+`
- `CREANCE` = `+`
- `DETTE` = `-`
- `REMBOURSEMENT` = `-`

**Conséquence critique :**
Si un client doit 100 000 FCFA (`CREANCE`), son solde devient `+100 000`.
S'il règle cette créance en payant 100 000 FCFA (`PAIEMENT`), la transaction est également enregistrée en positif (`+100 000`).
Le nouveau solde calculé sera de `+200 000` au lieu de `0`. 
Les créances et leurs paiements s'additionnent au lieu de s'annuler. 

## Réponse aux questions de l'audit
- **Comment représenter ce qu'un client me doit ?** Via une transaction `CREANCE`.
- **Comment représenter ce que je dois au client ?** Via une transaction `DETTE`.
- **Comment représenter de l'argent confié (fonds clients) ?** Il n'y a pas de distinction claire entre un `PAIEMENT` pour rembourser une créance et un dépôt initial sans créance.
- **Comment enregistrer une utilisation de ces fonds ?** Probablement en créant une `CREANCE`, mais les signes erronés faussent le calcul.
- **Les soldes sont-ils reconstructibles ?** Oui, car le solde n'est pas stocké en dur, il est calculé à la volée. Cependant, la formule de calcul actuelle est mathématiquement fausse en raison de l'absence d'opposition de signes entre une créance et un paiement.
- **Quelles opérations détruisent actuellement de l'historique ?** La modification d'une transaction via l'interface remplace purement et simplement le montant (après validation si > 5 min, ou directement si < 5 min). L'ancienne valeur est perdue. Aucun log d'audit n'est conservé. De plus, les scripts de maintenance (`fix_creances.ts`, `clear_db.ts`) détruisent des données.
