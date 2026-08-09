import { TypeTransaction } from '@prisma/client';
import { calculateClientBalance, normalizeTransactionAmount, getTransactionSign } from './finance';
import test from 'node:test';
import assert from 'node:assert';

test('Finance Logic', async (t) => {
  
  await t.test('normalizeTransactionAmount', () => {
    assert.strictEqual(normalizeTransactionAmount(100000), 100000);
    assert.strictEqual(normalizeTransactionAmount(-40000), 40000);
    assert.throws(() => normalizeTransactionAmount(NaN), /Montant invalide/);
    assert.throws(() => normalizeTransactionAmount(Infinity), /Montant invalide/);
  });

  await t.test('getTransactionSign', () => {
    assert.strictEqual(getTransactionSign(TypeTransaction.CREANCE), 1);
    assert.strictEqual(getTransactionSign(TypeTransaction.REMBOURSEMENT), 1);
    assert.strictEqual(getTransactionSign(TypeTransaction.PAIEMENT), -1);
    assert.strictEqual(getTransactionSign(TypeTransaction.DETTE), -1);
  });

  await t.test('calculateClientBalance - CREANCE simple', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.CREANCE, montant: 100000 }
    ]);
    assert.strictEqual(balance, 100000);
  });

  await t.test('calculateClientBalance - CREANCE et PAIEMENT total', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.CREANCE, montant: 100000 },
      { type: TypeTransaction.PAIEMENT, montant: 100000 }
    ]);
    assert.strictEqual(balance, 0);
  });

  await t.test('calculateClientBalance - CREANCE et PAIEMENT partiel', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.CREANCE, montant: 100000 },
      { type: TypeTransaction.PAIEMENT, montant: 40000 }
    ]);
    assert.strictEqual(balance, 60000);
  });

  await t.test('calculateClientBalance - Plusieurs paiements partiels', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.CREANCE, montant: 100000 },
      { type: TypeTransaction.PAIEMENT, montant: 30000 },
      { type: TypeTransaction.PAIEMENT, montant: 20000 }
    ]);
    assert.strictEqual(balance, 50000);
  });

  await t.test('calculateClientBalance - DETTE simple', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.DETTE, montant: 100000 }
    ]);
    assert.strictEqual(balance, -100000);
  });

  await t.test('calculateClientBalance - DETTE et REMBOURSEMENT', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.DETTE, montant: 100000 },
      { type: TypeTransaction.REMBOURSEMENT, montant: 40000 }
    ]);
    assert.strictEqual(balance, -60000);
  });

  await t.test('calculateClientBalance - Solde mixte (CREANCE + DETTE)', () => {
    const balance = calculateClientBalance([
      { type: TypeTransaction.CREANCE, montant: 100000 },
      { type: TypeTransaction.DETTE, montant: 30000 }
    ]);
    assert.strictEqual(balance, 70000);
  });

  await t.test('calculateClientBalance - Indépendance de l\'ordre des transactions', () => {
    const txs = [
      { type: TypeTransaction.CREANCE, montant: 100000 },
      { type: TypeTransaction.PAIEMENT, montant: 30000 },
      { type: TypeTransaction.DETTE, montant: 50000 }
    ];
    const b1 = calculateClientBalance(txs);
    
    // Ordre inversé
    const txsReversed = [...txs].reverse();
    const b2 = calculateClientBalance(txsReversed);

    assert.strictEqual(b1, 20000);
    assert.strictEqual(b1, b2);
  });

  await t.test('calculateClientBalance - Résilience aux anciennes données (montants négatifs)', () => {
    const balance = calculateClientBalance([
      // Historique corrompu: CREANCE stockée en négatif et PAIEMENT stocké en positif
      { type: TypeTransaction.CREANCE, montant: -100000 },
      { type: TypeTransaction.PAIEMENT, montant: +40000 }
    ]);
    // Math.abs(-100000) * 1 + Math.abs(+40000) * -1 = 100000 - 40000 = +60000
    assert.strictEqual(balance, 60000);
  });
});
