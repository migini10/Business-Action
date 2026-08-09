import test from 'node:test';
import assert from 'node:assert';
import { calculateFinancialSummary } from './finance';
import { TypeTransaction } from '@prisma/client';

test('Financial summary – CREANCE + PAIEMENT', () => {
  const txs = [
    { type: TypeTransaction.CREANCE, montant: 100000 },
    { type: TypeTransaction.PAIEMENT, montant: 40000 }
  ];
  const { totalCreances, totalDettes, balance } = calculateFinancialSummary(txs);
  assert.strictEqual(totalCreances, 100000);
  assert.strictEqual(totalDettes, 0);
  assert.strictEqual(balance, 60000);
});

test('Financial summary – DETTE + REMBOURSEMENT', () => {
  const txs = [
    { type: TypeTransaction.DETTE, montant: 100000 },
    { type: TypeTransaction.REMBOURSEMENT, montant: 40000 }
  ];
  const { totalCreances, totalDettes, balance } = calculateFinancialSummary(txs);
  assert.strictEqual(totalCreances, 0);
  assert.strictEqual(totalDettes, 100000);
  assert.strictEqual(balance, -60000);
});
