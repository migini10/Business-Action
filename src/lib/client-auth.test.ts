import test from 'node:test';
import assert from 'node:assert';
import { _registerClient } from '../app/actions/auth';

function createMockDeps(overrides = {}) {
  const db: any = {
    user: {
      findUnique: async () => null,
      create: async (args: any) => ({
        id: 'user-123',
        fullName: args.data.fullName,
        phone: args.data.phone,
        email: args.data.email
      })
    }
  };

  const hash = async (pwd: string) => `hashed_${pwd}`;

  return { db, hash, ...overrides };
}

function createFormData(data: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.append(key, value);
  }
  return fd;
}

test('Client Registration Logic: _registerClient', async (t) => {
  await t.test('inscription sans email => autorisée', async () => {
    const deps = createMockDeps();
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123' });
    const res = await _registerClient(fd, deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.phone, '77123');
  });

  await t.test('inscription avec email valide => autorisée', async () => {
    let createdData: any = null;
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async () => null,
          create: async (args: any) => {
            createdData = args.data;
            return { id: '1', fullName: args.data.fullName, phone: args.data.phone };
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123', email: 'john@example.com' });
    const res = await _registerClient(fd, deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(createdData.email, 'john@example.com');
  });

  await t.test('email avec majuscules/espaces => normalisé', async () => {
    let createdData: any = null;
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async () => null,
          create: async (args: any) => {
            createdData = args.data;
            return { id: '1', fullName: args.data.fullName, phone: args.data.phone };
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123', email: ' JOHN@ExaMple.com ' });
    const res = await _registerClient(fd, deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(createdData.email, 'john@example.com');
  });

  await t.test('email invalide => refus', async () => {
    const deps = createMockDeps();
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123', email: 'not-an-email' });
    const res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.field, 'email');
    assert.match(res.error as string, /format/i);
  });

  await t.test('email déjà utilisé => refus propre', async () => {
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async (args: any) => {
            if (args.where.email === 'john@example.com') return { id: '2' };
            return null;
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123', email: 'john@example.com' });
    const res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.field, 'email');
    assert.match(res.error as string, /déjà utilisée/i);
  });

  await t.test('téléphone déjà utilisé => refus propre', async () => {
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async (args: any) => {
            if (args.where.phone === '77123') return { id: '2' };
            return null;
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: ' 77123 ', password: 'password123' });
    const res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.field, 'phone');
    assert.match(res.error as string, /téléphone est déjà utilisé/i);
  });

  await t.test('email null sur plusieurs comptes => autorisé (pas de conflit Prisma en test unitaire)', async () => {
    // Si email est vide, il ne déclenche pas findUnique sur l'email.
    const deps = createMockDeps();
    let fd = createFormData({ name: 'John1', phone: '1', password: 'password123', email: '' });
    let res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, true);

    fd = createFormData({ name: 'John2', phone: '2', password: 'password123', email: '   ' });
    res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, true);
  });

  await t.test('erreur Prisma UNIQUE email => gérée proprement', async () => {
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async () => null,
          create: async () => {
            const err = new Error('Unique constraint') as any;
            err.code = 'P2002';
            err.meta = { target: ['email'] };
            throw err;
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123', email: 'john@example.com' });
    const res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.field, 'email');
    assert.match(res.error as string, /adresse email est déjà/i);
  });

  await t.test('erreur Prisma UNIQUE téléphone => gérée proprement', async () => {
    const deps = createMockDeps({
      db: {
        user: {
          findUnique: async () => null,
          create: async () => {
            const err = new Error('Unique constraint') as any;
            err.code = 'P2002';
            err.meta = { target: ['phone'] };
            throw err;
          }
        }
      }
    });
    const fd = createFormData({ name: 'John', phone: '77123', password: 'password123' });
    const res = await _registerClient(fd, deps) as any;
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.field, 'phone');
    assert.match(res.error as string, /téléphone est déjà utilisé/i);
  });
});
