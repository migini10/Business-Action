import test from 'node:test';
import assert from 'node:assert';
import { _verifyResetToken } from '../app/api/auth/verify-reset/route';
import crypto from 'crypto';

function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const mockSecret = 'test-secret';
const MOCK_NOW = 1700000000000;

function createMockDeps(overrides = {}) {
  const db: any = {
    passwordResetChallenge: {
      findFirst: async () => null,
    },
  };

  return {
    db,
    now: () => MOCK_NOW,
    otpSecret: mockSecret,
    ...overrides
  };
}

test('_verifyResetToken (route verify-reset)', async (t) => {
  await t.test('token manquant => refusé', async () => {
    const deps = createMockDeps();
    const res = await _verifyResetToken(null, deps);
    assert.strictEqual(res.success, false);
  });

  await t.test('token introuvable en base => refusé (aucun détail exposé)', async () => {
    const deps = createMockDeps();
    deps.db.passwordResetChallenge.findFirst = async () => null;

    const res = await _verifyResetToken('some-random-token', deps);
    assert.strictEqual(res.success, false);
    assert.strictEqual((res as any).error, undefined, "Aucun message d'erreur détaillé ne doit être exposé");
  });

  await t.test('token expiré => refusé', async () => {
    const deps = createMockDeps();
    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-token', mockSecret),
      resetTokenExpiresAt: new Date(MOCK_NOW - 10000), // expiré
    });

    const res = await _verifyResetToken('my-token', deps);
    assert.strictEqual(res.success, false);
  });

  await t.test('token valide, non expiré, non consommé => accepté, retourne challengeId + expiresAt (jamais le token)', async () => {
    const deps = createMockDeps();
    const expiresAt = new Date(MOCK_NOW + 10000);
    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-token', mockSecret),
      resetTokenExpiresAt: expiresAt,
    });

    const res: any = await _verifyResetToken('my-token', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.challengeId, 'chal1');
    assert.strictEqual(res.expiresAt.getTime(), expiresAt.getTime());
    assert.strictEqual(JSON.stringify(res).includes('my-token'), false, 'Le résultat ne doit jamais contenir le token brut');
  });

  await t.test('filtre exactement purpose: PASSWORD_RESET, usedAt: null, verifiedAt: not null', async () => {
    const deps = createMockDeps();
    let capturedWhere: any = null;
    deps.db.passwordResetChallenge.findFirst = async (q: any) => {
      capturedWhere = q.where;
      return null;
    };

    await _verifyResetToken('my-token', deps);
    assert.strictEqual(capturedWhere.purpose, 'PASSWORD_RESET');
    assert.strictEqual(capturedWhere.usedAt, null);
    assert.deepStrictEqual(capturedWhere.verifiedAt, { not: null });
  });

  await t.test('un challenge FIRST_PASSWORD_CHANGE ne doit jamais être consommable via ce lien (purpose non filtré côté DB simulée ici, mais la query doit exiger PASSWORD_RESET)', async () => {
    const deps = createMockDeps();
    // Simule une DB naïve qui ignorerait le filtre purpose : le test doit prouver
    // que la query envoyée par _verifyResetToken exige bien PASSWORD_RESET.
    let requestedPurpose: string | null = null;
    deps.db.passwordResetChallenge.findFirst = async (q: any) => {
      requestedPurpose = q.where.purpose;
      return null;
    };

    await _verifyResetToken('my-token', deps);
    assert.strictEqual(requestedPurpose, 'PASSWORD_RESET');
  });

  await t.test('GET est idempotent : aucune mutation (update/updateMany) déclenchée par la vérification', async () => {
    const deps = createMockDeps();
    let mutationCalled = false;
    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-token', mockSecret),
      resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
    });
    // Aucune méthode update/updateMany n'est même définie sur ce mock :
    // si _verifyResetToken tentait d'en appeler une, le test lèverait une TypeError.
    deps.db.passwordResetChallenge.update = () => { mutationCalled = true; throw new Error('update ne doit jamais être appelé'); };
    deps.db.passwordResetChallenge.updateMany = () => { mutationCalled = true; throw new Error('updateMany ne doit jamais être appelé'); };

    const res = await _verifyResetToken('my-token', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(mutationCalled, false, "_verifyResetToken ne doit jamais muter le challenge (consommation faite uniquement dans updatePassword)");
  });

  await t.test('erreur interne (DB down) => refus générique, pas de crash', async () => {
    const deps = createMockDeps();
    deps.db.passwordResetChallenge.findFirst = async () => { throw new Error('DB connection lost'); };

    const res = await _verifyResetToken('my-token', deps);
    assert.strictEqual(res.success, false);
  });
});
