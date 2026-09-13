import test from 'node:test';
import assert from 'node:assert';
import {
  _requestPasswordReset,
  _verifyOTP,
  _updatePassword
} from '../app/actions/reset-password';
import { signResetSession } from '@/lib/password-reset-crypto';
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
      updateMany: async () => ({ count: 1 }),
      create: async () => ({}),
      update: async () => ({})
    },
    clientSession: {
      deleteMany: async () => {}
    },
    // Supporte les deux styles Prisma $transaction :
    // - array-form (opérations déjà en vol) : retourne le tableau tel quel
    // - interactive (callback) : exécute la callback avec `db` lui-même comme `tx`
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') return arg(db);
      return arg;
    }
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
    sendWhatsApp: async (..._args: any[]): Promise<any> => ({ success: true }),
    whatsappTemplateName: 'password_recovery_link_dev',
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

  await t.test('WHATSAPP method: échec d\'envoi => anti-énumération préservée (succès générique, aucune erreur exposée, aucun challenge créé)', async () => {
    const deps = createMockDeps();
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    deps.sendWhatsApp = async () => ({ success: false, error: 'Not approved' });

    let createdChallenge = false;
    deps.db.passwordResetChallenge.create = async () => { createdChallenge = true; };

    const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
    assert.strictEqual(res.success, true, "Ne doit jamais révéler côté client que l'envoi WhatsApp a échoué");
    assert.match((res as any).message as string, /Si un compte correspondant existe/);
    assert.strictEqual((res as any).error, undefined, "Aucune erreur Meta ne doit être exposée à l'appelant");
    assert.ok(!createdChallenge, "Ne doit pas créer de challenge si l'envoi échoue");
  });

  await t.test('WHATSAPP method: template DEV fourni explicitement => transmis à sendWhatsApp', async () => {
    const deps = createMockDeps({ whatsappTemplateName: 'password_recovery_link_dev' });
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    let calledTemplate: string | undefined;
    deps.sendWhatsApp = async (phone: string, token: string, template?: string) => {
      calledTemplate = template;
      return { success: true };
    };
    const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(calledTemplate, 'password_recovery_link_dev');
  });

  await t.test('WHATSAPP method: template PROD fourni explicitement => transmis à sendWhatsApp', async () => {
    const deps = createMockDeps({ whatsappTemplateName: 'password_recovery_link' });
    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    let calledTemplate: string | undefined;
    deps.sendWhatsApp = async (phone: string, token: string, template?: string) => {
      calledTemplate = template;
      return { success: true };
    };
    const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(calledTemplate, 'password_recovery_link');
  });

  await t.test('WHATSAPP method: variable template absente => échec contrôlé, aucun appel WhatsApp, aucun challenge, aucun fallback PROD', async () => {
    const deps = createMockDeps({ whatsappTemplateName: undefined });
    const prevEnv = process.env.WHATSAPP_PASSWORD_RESET_TEMPLATE_NAME;
    delete process.env.WHATSAPP_PASSWORD_RESET_TEMPLATE_NAME;

    deps.db.user.findUnique = async () => ({ id: 'user1', phone: '221770000000' });
    let sendWhatsAppCalled = false;
    deps.sendWhatsApp = async () => {
      sendWhatsAppCalled = true;
      return { success: true };
    };
    let createdChallenge = false;
    deps.db.passwordResetChallenge.create = async () => { createdChallenge = true; };

    try {
      const res = await _requestPasswordReset('221770000000', 'WHATSAPP', deps);
      assert.strictEqual(res.success, true, "Réponse neutre anti-énumération pour l'appelant");
      assert.strictEqual((res as any).error, undefined, "Aucun détail d'erreur interne exposé au client");
      assert.strictEqual(sendWhatsAppCalled, false, "sendWhatsApp ne doit JAMAIS être appelé sans template explicite");
      assert.strictEqual(createdChallenge, false, "Aucun challenge ne doit être créé sans template valide");
    } finally {
      if (prevEnv !== undefined) process.env.WHATSAPP_PASSWORD_RESET_TEMPLATE_NAME = prevEnv;
    }
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
    const originalTransaction = deps.db.$transaction;
    deps.db.$transaction = async (arg: any) => {
      transactionCalled = true;
      return originalTransaction(arg);
    };

    let consumedWhere: any = null;
    deps.db.passwordResetChallenge.updateMany = async (q: any) => {
      consumedWhere = q.where;
      return { count: 1 };
    };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, true);
    assert.ok(transactionCalled, "Doit utiliser une transaction Prisma");
    assert.ok(consumedWhere, "La consommation atomique du token doit avoir eu lieu");
    assert.strictEqual(consumedWhere.usedAt, null, "La consommation doit être gardée par usedAt: null (protection TOCTOU)");
    assert.strictEqual(deps.cookies['password_reset_token'], undefined, "Le cookie doit être supprimé");
  });

  await t.test('Deux consommations concurrentes du même token => une seule réussit (protection TOCTOU)', async () => {
    const deps = createMockDeps();
    deps.setCookie('password_reset_token', 'my-raw-token', {});

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      resetTokenHash: hashString('my-raw-token', mockSecret),
      resetTokenExpiresAt: new Date(MOCK_NOW + 10000)
    });

    // Simule une consommation atomique : la 1ère updateMany "gagne" (count:1),
    // toute updateMany suivante sur le même token trouve déjà usedAt non-null (count:0).
    let consumeCount = 0;
    deps.db.passwordResetChallenge.updateMany = async () => {
      consumeCount++;
      return { count: consumeCount === 1 ? 1 : 0 };
    };

    const [res1, res2] = await Promise.all([
      _updatePassword('newpass123', deps),
      _updatePassword('otherpass456', deps),
    ]);

    const successes = [res1, res2].filter((r: any) => r.success);
    const failures = [res1, res2].filter((r: any) => !r.success);
    assert.strictEqual(successes.length, 1, "Une seule des deux tentatives concurrentes doit réussir");
    assert.strictEqual(failures.length, 1, "L'autre tentative doit être refusée");
    assert.match((failures[0] as any).error as string, /non valide ou déjà utilisée/);
  });

  await t.test('Reset OTP sur un compte mustChangePassword=true avec temp password expiré => réinitialise aussi les flags de mot de passe temporaire', async () => {
    const deps = createMockDeps();
    deps.setCookie('password_reset_token', 'my-raw-token', {});

    // Etat avant reset: mustChangePassword=true, temporaryPasswordExpiresAt expiré depuis avant le reset
    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      resetTokenHash: hashString('my-raw-token', mockSecret),
      resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
      user: {
        id: 'user1',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(MOCK_NOW - 999999999) // largement expiré
      }
    });

    let updateData: any = null;
    deps.db.user.update = async ({ data }: any) => { updateData = data; };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, true);
    assert.ok(updateData, "user.update doit avoir été appelé");
    assert.ok(updateData.password, "le nouveau hash de mot de passe doit être défini");
    assert.strictEqual(updateData.mustChangePassword, false, "mustChangePassword doit repasser à false après un reset OTP réussi");
    assert.strictEqual(updateData.temporaryPasswordExpiresAt, null, "temporaryPasswordExpiresAt doit être remis à null après un reset OTP réussi");
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

  // --- Flux WHATSAPP : session temporaire signée (jamais le token brut) ---

  await t.test('Session signée valide (WhatsApp) => password update, aucun token brut requis', async () => {
    const deps = createMockDeps();
    const sessionValue = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW + 10000 }, mockSecret);
    deps.setCookie('password_reset_session', sessionValue, {});

    let findWhere: any = null;
    deps.db.passwordResetChallenge.findFirst = async (q: any) => {
      findWhere = q.where;
      return {
        id: 'chal1',
        userId: 'user1',
        resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
      };
    };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(findWhere.id, 'chal1', 'Le lookup doit se faire par id de challenge, jamais par un hash dérivé du token brut');
    assert.strictEqual(findWhere.resetTokenHash, undefined, 'Aucun token brut ne doit intervenir dans la vérification de session WhatsApp');
    assert.strictEqual(deps.cookies['password_reset_session'], undefined, 'Le cookie de session doit être supprimé après succès');
  });

  await t.test('Session falsifiée (signature invalide) => refusée', async () => {
    const deps = createMockDeps();
    const legit = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW + 10000 }, mockSecret);
    const [encoded] = legit.split('.');
    const tampered = `${encoded}.aW52YWxpZC1zaWduYXR1cmU`; // signature bidon, même longueur base64url approx
    deps.setCookie('password_reset_session', tampered, {});

    let findFirstCalled = false;
    deps.db.passwordResetChallenge.findFirst = async () => { findFirstCalled = true; return null; };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /invalide ou expirée/);
    assert.ok(!findFirstCalled, "Une session dont la signature ne vérifie pas ne doit déclencher aucune requête DB");
  });

  await t.test('Session expirée (exp dépassé) => refusée sans requête DB', async () => {
    const deps = createMockDeps();
    const expiredSession = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW - 1000 }, mockSecret);
    deps.setCookie('password_reset_session', expiredSession, {});

    let findFirstCalled = false;
    deps.db.passwordResetChallenge.findFirst = async () => { findFirstCalled = true; return null; };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /invalide ou expirée/);
    assert.ok(!findFirstCalled, "Une session expirée doit être refusée avant toute requête DB");
  });

  await t.test('Session valide mais challenge déjà consommé (usedAt non null) => refusée (replay du lien/session)', async () => {
    const deps = createMockDeps();
    const sessionValue = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW + 10000 }, mockSecret);
    deps.setCookie('password_reset_session', sessionValue, {});

    // Simule fidèlement le filtre réel : un challenge déjà consommé ne matche plus usedAt: null
    deps.db.passwordResetChallenge.findFirst = async (q: any) => {
      if (q.where.usedAt === null) return null;
      return null;
    };

    const res = await _updatePassword('newpass123', deps);
    assert.strictEqual(res.success, false);
    assert.match((res as any).error as string, /Demande non valide ou déjà utilisée/);
  });

  await t.test('Rejeu de la même session après consommation réussie => refusé', async () => {
    const deps = createMockDeps();
    const sessionValue = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW + 10000 }, mockSecret);
    deps.setCookie('password_reset_session', sessionValue, {});

    let consumed = false;
    deps.db.passwordResetChallenge.findFirst = async () => {
      if (consumed) return null; // déjà utilisé => usedAt: null ne matche plus
      return { id: 'chal1', userId: 'user1', resetTokenExpiresAt: new Date(MOCK_NOW + 10000) };
    };
    deps.db.passwordResetChallenge.updateMany = async () => { consumed = true; return { count: 1 }; };

    const first = await _updatePassword('newpass123', deps);
    assert.strictEqual(first.success, true);

    // Deuxième appel avec la même session cookie (déjà supprimée en pratique, mais on
    // prouve ici que même rejouée manuellement elle est refusée côté serveur)
    deps.setCookie('password_reset_session', sessionValue, {});
    const second = await _updatePassword('otherpass456', deps);
    assert.strictEqual(second.success, false);
    assert.match((second as any).error as string, /Demande non valide ou déjà utilisée/);
  });

  await t.test('Deux consommations concurrentes de la même session WhatsApp => une seule réussit (protection TOCTOU)', async () => {
    const deps = createMockDeps();
    const sessionValue = signResetSession({ challengeId: 'chal1', exp: MOCK_NOW + 10000 }, mockSecret);
    deps.setCookie('password_reset_session', sessionValue, {});

    deps.db.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      userId: 'user1',
      resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
    });

    let consumeCount = 0;
    deps.db.passwordResetChallenge.updateMany = async () => {
      consumeCount++;
      return { count: consumeCount === 1 ? 1 : 0 };
    };

    const [res1, res2] = await Promise.all([
      _updatePassword('newpass123', deps),
      _updatePassword('otherpass456', deps),
    ]);

    const successes = [res1, res2].filter((r: any) => r.success);
    assert.strictEqual(successes.length, 1, "Une seule des deux tentatives concurrentes sur la même session doit réussir");
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
