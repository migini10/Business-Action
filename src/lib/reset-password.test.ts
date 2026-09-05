import test from 'node:test';
import assert from 'node:assert';
import {
  _requestPasswordReset,
  _verifyOTP,
  _updatePassword
} from '../app/actions/reset-password';
import crypto from 'crypto';

function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const mockSecret = 'test-secret';
const MOCK_NOW = 1700000000000;

function createMockDeps(overrides = {}) {
  const db: any = {
    user: { findUnique: async () => null, update: async () => {} },
    passwordResetChallenge: {
      findFirst: async () => null,
      updateMany: async () => {},
      create: async () => ({}),
      update: async () => ({})
    },
    clientSession: {
      deleteMany: async () => {}
    },
    $transaction: async (queries: any) => queries
  };

  const cookies: Record<string, any> = {};

  return {
    db,
    now: () => MOCK_NOW,
    otpSecret: mockSecret,
    generateOTP: () => '123456',
    resendConfigured: false,
    sendEmail: async () => {},
    isProduction: false,
    setCookie: async (name: string, value: string, opts: any) => {
      cookies[name] = { value, opts };
    },
    getCookie: async (name: string) => cookies[name]?.value,
    deleteCookie: async (name: string) => { delete cookies[name]; },
    cookies, // For test inspection
    sendWhatsApp: async () => ({ success: true }),
    ...overrides
  };
}

test('Business Logic: requestPasswordReset', async (t) => {
  await t.test('Anti-enumeration: numéro inexistant => réponse neutre', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => null; // Numéro n'existe pas

    const res = await _requestPasswordReset('221770000000', 'EMAIL', deps);
    assert.strictEqual(res.success, true);
    assert.match((res as any).message as string, /Si un compte correspondant existe/);
  });

  await t.test('Numéro existant => réponse neutre', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000', email: 'test@example.com' });
    deps.resendConfigured = true;

    let createdChallenge = false;
    deps.db.passwordResetChallenge.create = async () => { createdChallenge = true; };

    const res = await _requestPasswordReset('221770000000', 'EMAIL', deps);
    assert.strictEqual(res.success, true);
    assert.match((res as any).message as string, /Si un compte correspondant existe/);
    assert.ok(createdChallenge, "Le challenge a dû être créé en base");
  });

  await t.test('Cooldown 3 minutes', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    // Simulate an existing recent challenge
    deps.db.passwordResetChallenge.findFirst = async () => ({ id: 'chal1' });

    const res = await _requestPasswordReset('221770000000', 'EMAIL', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /patienter 3 minutes/);
  });

  await t.test('requestPasswordReset utilise purpose: PASSWORD_RESET', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000', email: 'test@example.com' });
    deps.resendConfigured = true;

    let findFirstQuery: any = null;
    deps.db.passwordResetChallenge.findFirst = async (q: any) => { findFirstQuery = q; return null; };

    let createQuery: any = null;
    deps.db.passwordResetChallenge.create = async (q: any) => { createQuery = q; return {}; };

    await _requestPasswordReset('221770000000', 'EMAIL', deps);
    assert.strictEqual(findFirstQuery.where.purpose, 'PASSWORD_RESET');
    assert.strictEqual(createQuery.data.purpose, 'PASSWORD_RESET');
  });

  await t.test('WHATSAPP method: failure to send does not create challenge', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    deps.sendWhatsApp = async () => ({ success: false, error: 'Not approved' });
    
    let createdChallenge = false;
    deps.db.passwordResetChallenge.create = async () => { createdChallenge = true; };

    const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
    assert.strictEqual(res.success, false);
    assert.strictEqual((res as any).error, 'Not approved');
    assert.ok(!createdChallenge, "Ne doit pas créer de challenge si l'envoi échoue");
  });

  await t.test('WHATSAPP method: successful send creates challenge', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    deps.sendWhatsApp = async () => ({ success: true });
    
    let createdChallenge = false;
    deps.db.passwordResetChallenge.create = async () => { createdChallenge = true; };

    const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
    assert.strictEqual(res.success, true);
    assert.ok(createdChallenge, "Le challenge a dû être créé en base");
  });
});

test('Business Logic: verifyOTP', async (t) => {
  await t.test('OTP invalide', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });

    // Valid challenge in DB, but with different OTP hash
    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      otpHash: hashString('654321', mockSecret),
      expiresAt: new Date(MOCK_NOW + 10000), // not expired
      attempts: 0
    });

    let incrementedAttempts = false;
    deps.db.passwordResetChallenge.update = async ({ data }: any) => {
      if (data.attempts?.increment === 1) incrementedAttempts = true;
    };

    const res = await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /Code incorrect/);
    assert.ok(incrementedAttempts, "Les tentatives doivent être incrémentées");
  });

  await t.test('OTP expiré', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1' });

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      otpHash: hashString('123456', mockSecret),
      expiresAt: new Date(MOCK_NOW - 10000), // Expired
      attempts: 0
    });

    const res = await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /a expiré/);
  });

  await t.test('3 tentatives => bloqué', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1' });

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      otpHash: hashString('123456', mockSecret),
      expiresAt: new Date(MOCK_NOW + 10000),
      attempts: 3 // Already at 3
    });

    let invalidated = false;
    deps.db.passwordResetChallenge.update = async ({ data }: any) => {
      if (data.usedAt) invalidated = true;
    };

    const res = await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /Trop de tentatives/);
    assert.ok(invalidated, "Le challenge doit être invalidé");
  });

  await t.test('OTP valide => verified + cookie set', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1' });

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      otpHash: hashString('123456', mockSecret),
      expiresAt: new Date(MOCK_NOW + 10000),
      attempts: 0
    });

    let verified = false;
    deps.db.passwordResetChallenge.update = async ({ data }: any) => {
      if (data.verifiedAt && data.resetTokenHash) verified = true;
    };

    const res = await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(res.success, true);
    assert.ok(verified, "Doit enregistrer le verifiedAt et le resetTokenHash");
    assert.ok(deps.cookies['password_reset_token'], "Le cookie de token doit être défini");
    assert.strictEqual(deps.cookies['password_reset_token'].opts.httpOnly, true);
  });

  await t.test('verifyOTP utilise purpose: PASSWORD_RESET', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1' });

    let findFirstQuery: any = null;
    deps.db.passwordResetChallenge.findFirst = async (q: any) => { findFirstQuery = q; return null; };

    await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(findFirstQuery.where.purpose, 'PASSWORD_RESET');
  });
  await t.test('verifyOTP refuse un challenge avec purpose: FIRST_PASSWORD_CHANGE', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1' });

    // Mock findFirst pour retourner le challenge SEULEMENT s'il n'y a pas de filtre,
    // ou si on demande le mauvais purpose. Mais le code de prod demande PASSWORD_RESET.
    deps.db.passwordResetChallenge.findFirst = async (query: any) => {
      // En base, le challenge est un FIRST_PASSWORD_CHANGE
      if (query.where.purpose === 'PASSWORD_RESET') {
        return null; // La DB ne trouve pas de PASSWORD_RESET car c'est un FIRST_PASSWORD_CHANGE
      }
      return {
        id: 'chal1',
        otpHash: hashString('123456', mockSecret),
        expiresAt: new Date(MOCK_NOW + 10000),
        attempts: 0,
        purpose: 'FIRST_PASSWORD_CHANGE'
      };
    };

    const res = await _verifyOTP('221770000000', '123456', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /Aucune demande de réinitialisation en cours/);
  });
});

test('Business Logic: updatePassword', async (t) => {
  await t.test('Token manquant/invalide refusé', async () => {
    const deps = createMockDeps(); // No cookie set
    const res: any = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /invalide ou expirée/);
  });

  await t.test('updatePassword refuse un challenge avec purpose: FIRST_PASSWORD_CHANGE', async () => {
    const deps = createMockDeps();
    deps.setCookie('password_reset_token', 'my-raw-token', {});

    deps.db.passwordResetChallenge.findFirst = async (query: any) => {
      if (query.where.purpose === 'PASSWORD_RESET') {
        return null; // Pas trouvé avec le filtre PASSWORD_RESET
      }
      return {
        id: 'chal1',
        userId: 'user1',
        resetTokenHash: hashString('my-raw-token', mockSecret),
        resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
        purpose: 'FIRST_PASSWORD_CHANGE'
      };
    };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /Demande non valide ou déjà utilisée/);
  });

  await t.test('Token valide => password update & atomic ops', async () => {
    const deps = createMockDeps();
    deps.setCookie('password_reset_token', 'my-raw-token', {});

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      resetTokenHash: hashString('my-raw-token', mockSecret),
      resetTokenExpiresAt: new Date(MOCK_NOW + 10000)
    });

    let transactionCalled = false;
    deps.db.$transaction = async (queries: any) => {
      transactionCalled = true;
      return queries;
    };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, true);
    assert.ok(transactionCalled, "Doit utiliser une transaction Prisma");
    assert.strictEqual(deps.cookies['password_reset_token'], undefined, "Le cookie doit être supprimé");
  });

  await t.test('Token expiré refusé', async () => {
    const deps = createMockDeps();
    deps.setCookie('password_reset_token', 'my-raw-token', {});

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      resetTokenExpiresAt: new Date(MOCK_NOW - 10000) // expired
    });

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /a expiré/);
  });
});

test('Password Reset Crypto Logic', async (t) => {
  await t.test('generateOTP - always generates 6 digits', () => {
    // Simulated generateOTP since it's now private
    const genOTP = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    for (let i = 0; i < 100; i++) {
      const otp = genOTP();
      assert.strictEqual(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
    }
  });

  await t.test('hashString - generates consistent HMAC SHA256', () => {
    const secret = 'my-secret';
    const otp = '123456';
    const hash1 = hashString(otp, secret);
    const hash2 = hashString(otp, secret);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
    const hash3 = hashString(otp, 'other-secret');
    assert.notStrictEqual(hash1, hash3);
  });

  await t.test('timingSafeEqual - comparison', () => {
    const secret = 'my-secret';
    const otp = '123456';
    const hash1 = hashString(otp, secret);
    const hash2 = hashString(otp, secret);
    const hash3 = hashString('654321', secret);
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    const buf3 = Buffer.from(hash3, 'hex');
    assert.ok(crypto.timingSafeEqual(buf1, buf2));
    assert.ok(!crypto.timingSafeEqual(buf1, buf3));
  });
});
