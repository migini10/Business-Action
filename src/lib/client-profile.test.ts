import test from 'node:test';
import assert from 'node:assert';
import { _updateClientProfile } from '../app/actions/client';
import { Prisma } from '@prisma/client';

import { UpdateClientProfileDeps } from '../app/actions/client';

function createMockDeps(overrides: Partial<UpdateClientProfileDeps> = {}): UpdateClientProfileDeps {
  const db = {
    user: {
      update: async (args: Prisma.UserUpdateArgs) => ({
        id: args.where.id as string,
        fullName: args.data.fullName as string,
        phone: args.data.phone as string,
        email: (args.data.email as string) || null,
      })
    }
  };

  const requireClient = async () => ({
    id: 'user-123',
    fullName: 'Test User',
    phone: '770000000',
    email: 'test@example.com'
  });

  return { db, requireClient, ...overrides } as UpdateClientProfileDeps;
}

function createFormData(data: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.append(key, value);
  }
  return fd;
}

test('updateClientProfile', async (t) => {
  await t.test('devrait mettre à jour le profil avec succès (identité de la session)', async () => {
    let updateCalled = false;
    const deps = createMockDeps({
      db: {
        user: {
          update: async (args: Prisma.UserUpdateArgs) => {
            updateCalled = true;
            assert.strictEqual(args.where.id, 'user-123');
            return {
              id: 'user-123',
              fullName: args.data.fullName as string,
              phone: args.data.phone as string,
              email: (args.data.email as string) || null
            };
          }
        }
      }
    });

    const fd = createFormData({
      fullName: 'Nouveau Nom',
      phone: '771112233  ',
      email: ' NEW@Email.com ',
    });

    const res = await _updateClientProfile(fd, deps);
    assert.strictEqual(updateCalled, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.name, 'Nouveau Nom');
    assert.strictEqual(res.user?.phone, '771112233');
    assert.strictEqual(res.user?.email, 'new@email.com');
  });

  await t.test('devrait refuser si le téléphone est vide ou manquant', async () => {
    const deps = createMockDeps();
    const fd = createFormData({
      fullName: 'Nouveau Nom',
      phone: '   ',
    });

    const res = await _updateClientProfile(fd, deps);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Le numéro de téléphone est obligatoire.');
  });

  await t.test('devrait traiter un email vide comme null', async () => {
    let updateCalledWithEmailNull = false;
    const deps = createMockDeps({
      db: {
        user: {
          update: async (args: Prisma.UserUpdateArgs) => {
            if (args.data.email === null) {
              updateCalledWithEmailNull = true;
            }
            return {
              id: 'user-123',
              fullName: args.data.fullName as string,
              phone: args.data.phone as string,
              email: (args.data.email as string) || null
            };
          }
        }
      }
    });

    const fd = createFormData({
      fullName: 'Nouveau Nom',
      phone: '771112233',
      email: '   ',
    });

    const res = await _updateClientProfile(fd, deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(updateCalledWithEmailNull, true);
    assert.strictEqual(res.user?.email, null);
  });

  await t.test('devrait gérer proprement la collision P2002 sur le téléphone', async () => {
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.x',
      meta: { target: ['phone'] }
    });

    const deps = createMockDeps({
      db: {
        user: {
          update: async () => { throw p2002Error; }
        }
      }
    });

    const fd = createFormData({
      fullName: 'Nom',
      phone: '778889999',
    });

    const res = await _updateClientProfile(fd, deps);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Ce numéro de téléphone est déjà utilisé par un autre compte.');
    assert.strictEqual((res as { field?: string }).field, 'phone');
  });

  await t.test('devrait gérer proprement la collision P2002 sur l\'email', async () => {
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.x',
      meta: { target: ['email'] }
    });

    const deps = createMockDeps({
      db: {
        user: {
          update: async () => { throw p2002Error; }
        }
      }
    });

    const fd = createFormData({
      fullName: 'Nom',
      phone: '778889999',
      email: 'used@example.com'
    });

    const res = await _updateClientProfile(fd, deps);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Cette adresse email est déjà utilisée par un autre compte.');
    assert.strictEqual((res as { field?: string }).field, 'email');
  });

  await t.test('devrait empêcher IDOR : aucune donnée du formulaire ne doit remplacer l\'identité du client', async () => {
    let updateCalledWithCorrectId = false;
    const deps = createMockDeps({
      requireClient: async () => ({
        id: 'user-123', // True identity from secure session
        fullName: 'Test User',
        phone: '770000000',
        email: null
      }),
      db: {
        user: {
          update: async (args: Prisma.UserUpdateArgs) => {
            // Strict verification: it must use 'user-123' from the session
            assert.strictEqual(args.where.id, 'user-123');
            updateCalledWithCorrectId = true;
            return {
              id: args.where.id as string,
              fullName: args.data.fullName as string,
              phone: args.data.phone as string,
              email: (args.data.email as string) || null,
            };
          }
        }
      }
    });

    const fd = createFormData({
      // Attack attempt: Injecting another user's ID
      userId: 'victim-user',
      clientId: 'victim-client',
      id: 'victim-user',
      fullName: 'Hacked Name',
      phone: '779998877'
    });

    const res = await _updateClientProfile(fd, deps);

    assert.strictEqual(res.success, true);
    assert.strictEqual(updateCalledWithCorrectId, true);
    // The updated user ID in the result must strictly be 'user-123'
    assert.strictEqual(res.user?.id, 'user-123');
  });
});
