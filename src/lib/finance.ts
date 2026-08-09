import { TypeTransaction } from '@prisma/client';

/**
 * Normalise un montant pour le stockage en base de données.
 * Le système doit toujours stocker une magnitude positive (valeur absolue).
 * La sémantique (crédit/débit) est déterminée par le TypeTransaction.
 */
export function normalizeTransactionAmount(montant: number): number {
  if (typeof montant !== 'number' || isNaN(montant) || !isFinite(montant)) {
    throw new Error('Montant invalide');
  }
  return Math.abs(montant);
}

/**
 * Retourne le signe comptable métier d'une transaction.
 * +1 = Le client me doit (augmente le solde du client)
 * -1 = Le client paie ou je dois au client (diminue le solde du client)
 * 
 * Convention :
 * Le solde = Reste dû par le client.
 * CREANCE       (+1)
 * PAIEMENT      (-1)
 * DETTE         (-1)
 * REMBOURSEMENT (+1)
 */
export function getTransactionSign(type: TypeTransaction): number {
  switch (type) {
    case TypeTransaction.CREANCE:
    case TypeTransaction.REMBOURSEMENT:
      return 1;
    case TypeTransaction.PAIEMENT:
    case TypeTransaction.DETTE:
      return -1;
    default:
      // Exhaustif grâce à l'enum Prisma, mais par sécurité à l'exécution :
      throw new Error(`Type de transaction non supporté: ${type}`);
  }
}

/**
 * Calcule le solde (position financière nette) d'un client à partir de ses transactions.
 * Pour garantir la compatibilité avec l'historique potentiellement corrompu, 
 * on utilise Math.abs() sur le montant avant d'appliquer le signe correct basé sur le type.
 */
export function calculateClientBalance(transactions: { type: TypeTransaction; montant: number }[]): number {
  return transactions.reduce((solde, tx) => {
    const magnitude = Math.abs(tx.montant);
    const signe = getTransactionSign(tx.type);
    return solde + (magnitude * signe);
  }, 0);
}
