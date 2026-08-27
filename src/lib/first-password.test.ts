import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { _executeFirstPasswordChange } from '../app/actions/first-password';

const MOCK_NOW = 1700000000000;

function createMockDeps(overrides: any = {}) {
  const cookiesMap: Record<string, any> = {};
  
  return {
    db: {
      passwordResetChallenge: {
        findFirst: async (query?: any): Promise<any> => null,
        updateMany: async (query?: any): Promise<any> => ({ count: 1 }),
      },
      user: {
        update: async (query?: any): Promise<any> => ({}),
      },
      clientSession: {
        deleteMany: async (query?: any): Promise<any> => ({}),
      },
      $transaction: async (fn: any) => {
        // Pour les tests unitaires de _executeFirstPasswordChange, tx est un mock de db lui-même
        return fn({
          passwordResetChallenge: overrides.tx?.passwordResetChallenge || {
            findFirst: async (query?: any): Promise<any> => null,
            updateMany: async (query?: any): Promise<any> => ({ count: 1 }),
          },
          user: overrides.tx?.user || {
            update: async (query?: any): Promise<any> => ({}),
          },
          clientSession: overrides.tx?.clientSession || {
            deleteMany: async (query?: any): Promise<any> => ({}),
          }
        });
      }
    },
    hash: async (p: string) => `hashed_${p}`,
    now: () => MOCK_NOW,
    cookies: async () => ({
      get: (name: string) => cookiesMap[name] || null,
      delete: (name: string) => { delete cookiesMap[name]; },
    }),
    createSession: async (id: string) => {},
    setCookie: (name: string, value: string) => {
      cookiesMap[name] = { value: value };
    }
  };
}

test('FIRST_PASSWORD_CHANGE Logic', async (t) => {
  // 1. client normal => login inchangé (Couvert dans client-auth.test.ts ou auth.test.ts)
  // 2. mustChangePassword=true + expiry future => challenge créé (Couvert dans auth.test.ts)
  
  // 3 & 4. Expiry passée / null (Géré dans auth.ts, et ici lors de la consommation)
  await t.test('3/4/8. Challenge expiré ou invalide refusé', async () => {
    const deps = createMockDeps();
    deps.setCookie('first_password_token', 'token123');
    deps.db.$transaction = async (fn: any) => fn({
      passwordResetChallenge: {
        findFirst: async () => ({
          id: 'chal1',
          userId: 'user1',
          resetTokenExpiresAt: new Date(MOCK_NOW - 10000), // Expiré
        })
      }
    });
    const res = await _executeFirstPasswordChange('newpassword123', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error as string, /invalide ou expirée/);
  });

  // 7. Changement réussi => password + flags nettoyés
  await t.test('7. Changement réussi => password + flags nettoyés', async () => {
    const deps = createMockDeps();
    deps.setCookie('first_password_token', 'token123');
    
    let userUpdateArgs: any = null;
    let sessionDeleteArgs: any = null;
    let updateManyArgs: any = null;

    deps.db.$transaction = async (fn: any) => fn({
      passwordResetChallenge: {
        findFirst: async () => ({
          id: 'chal1',
          userId: 'user1',
          resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
        }),
        updateMany: async (args: any) => {
          updateManyArgs = args;
          return { count: 1 };
        }
      },
      user: {
        update: async (args: any) => { userUpdateArgs = args; }
      },
      clientSession: {
        deleteMany: async (args: any) => { sessionDeleteArgs = args; }
      }
    });

    const res = await _executeFirstPasswordChange('newpwd', deps);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(userUpdateArgs.data.mustChangePassword, false);
    assert.deepStrictEqual(userUpdateArgs.data.temporaryPasswordExpiresAt, null);
    assert.strictEqual(userUpdateArgs.data.password, 'hashed_newpwd');
    assert.strictEqual(sessionDeleteArgs.where.userId, 'user1');
    assert.strictEqual(updateManyArgs.where.id, 'chal1');
    assert.strictEqual(updateManyArgs.where.usedAt, null);
  });

  // 9. Challenge déjà utilisé => refus
  await t.test('9. Challenge déjà utilisé (count === 0) => refus', async () => {
    const deps = createMockDeps();
    deps.setCookie('first_password_token', 'token123');
    deps.db.$transaction = async (fn: any) => fn({
      passwordResetChallenge: {
        findFirst: async () => ({
          id: 'chal1',
          userId: 'user1',
          resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
        }),
        updateMany: async () => ({ count: 0 }) // Simule qu'un autre processus l'a pris
      }
    });
    const res = await _executeFirstPasswordChange('newpwd', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error as string, /déjà utilisée/);
  });

  // 11. FIRST_PASSWORD_CHANGE ne peut pas consommer PASSWORD_RESET
  await t.test('11. FIRST_PASSWORD_CHANGE ne peut consommer PASSWORD_RESET', async () => {
    const deps = createMockDeps();
    deps.setCookie('first_password_token', 'token123');
    deps.db.$transaction = async (fn: any) => fn({
      passwordResetChallenge: {
        findFirst: async (q: any) => {
          // Si on cherche avec purpose = FIRST_PASSWORD_CHANGE mais que la bdd n'a que PASSWORD_RESET
          // Prisma retournera null car ça ne match pas.
          assert.strictEqual(q.where.purpose, 'FIRST_PASSWORD_CHANGE');
          return null;
        }
      }
    });
    const res = await _executeFirstPasswordChange('newpwd', deps);
    assert.strictEqual(res.success, false);
  });

  // 13. Deux executeFirstPasswordChange concurrents
  await t.test('13. Concurrence => exactement un seul peut consommer', async () => {
    const deps = createMockDeps();
    deps.setCookie('first_password_token', 'token123');
    
    let isFirst = true;
    deps.db.$transaction = async (fn: any) => fn({
      passwordResetChallenge: {
        findFirst: async () => ({
          id: 'chal1',
          userId: 'user1',
          resetTokenExpiresAt: new Date(MOCK_NOW + 10000),
        }),
        updateMany: async () => {
          if (isFirst) {
            isFirst = false;
            return { count: 1 };
          }
          return { count: 0 };
        }
      },
      user: { update: async () => ({}) },
      clientSession: { deleteMany: async () => ({}) }
    });

    const [res1, res2] = await Promise.all([
      _executeFirstPasswordChange('pwd1', deps),
      _executeFirstPasswordChange('pwd2', deps)
    ]);
    
    // Un succès et un échec
    assert.strictEqual([res1.success, res2.success].filter(Boolean).length, 1);
  });
});
