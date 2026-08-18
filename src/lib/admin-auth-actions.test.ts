import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

const mockCookieStore = {
  set: mock.fn(),
  get: mock.fn(),
  delete: mock.fn(),
};

require.cache[require.resolve('next/headers')] = {
  id: require.resolve('next/headers'),
  filename: require.resolve('next/headers'),
  loaded: true,
  exports: { cookies: async () => mockCookieStore, __esModule: true }
} as any;

const mockPrisma = {
  adminSession: {
    create: mock.fn(async () => ({})),
  }
};

require.cache[require.resolve('./prisma')] = {
  id: require.resolve('./prisma'),
  filename: require.resolve('./prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
} as any;

const { loginAdmin } = require('@/app/actions/admin-auth-actions');

describe('loginAdmin (Fail-Closed Auth)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockCookieStore.set.mock.resetCalls();
    mockPrisma.adminSession.create.mock.resetCalls();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createFormData = (user?: string, password?: string) => {
    const fd = new FormData();
    if (user !== undefined) fd.append('user', user);
    if (password !== undefined) fd.append('password', password);
    return fd;
  };

  test('variables valides => login possible', async () => {
    process.env.ADMIN_USER = 'testadmin';
    process.env.ADMIN_PASSWORD = 'testpassword';
    
    const fd = createFormData('testadmin', 'testpassword');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, true);
  });

  test('mot de passe incorrect => refus', async () => {
    process.env.ADMIN_USER = 'testadmin';
    process.env.ADMIN_PASSWORD = 'testpassword';
    
    const fd = createFormData('testadmin', 'wrongpassword');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('utilisateur incorrect => refus', async () => {
    process.env.ADMIN_USER = 'testadmin';
    process.env.ADMIN_PASSWORD = 'testpassword';
    
    const fd = createFormData('wrongadmin', 'testpassword');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('ADMIN_USER absent => refus (Fail-closed)', async () => {
    delete process.env.ADMIN_USER;
    process.env.ADMIN_PASSWORD = 'testpassword';
    
    const fd = createFormData('admin', 'testpassword');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('ADMIN_PASSWORD absent => refus (Fail-closed)', async () => {
    process.env.ADMIN_USER = 'testadmin';
    delete process.env.ADMIN_PASSWORD;
    
    const fd = createFormData('testadmin', 'bizness2026');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('les deux absents => refus (Fail-closed)', async () => {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD;
    
    const fd = createFormData('admin', 'bizness2026');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('aucun fallback historique ne fonctionne', async () => {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD;
    
    const fd = createFormData('admin', 'bizness2026');
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants incorrects');
  });

  test('formulaire vide => refus', async () => {
    const fd = createFormData();
    const result = await loginAdmin(fd);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Identifiants requis');
  });
});
