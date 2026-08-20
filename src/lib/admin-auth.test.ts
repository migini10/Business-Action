// @ts-nocheck

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// Use require.cache to mock next/headers and @/lib/prisma
const mockCookieStore = {
  set: mock.fn(),
  get: mock.fn(),
  delete: mock.fn(),
};

const mockPrisma = {
  adminSession: {
    create: mock.fn(async () => ({})),
    findUnique: mock.fn(async () => null),
    update: mock.fn(async () => ({}))
  }
};

require.cache[require.resolve('next/headers')] = {
  id: require.resolve('next/headers'),
  filename: require.resolve('next/headers'),
  loaded: true,
  exports: { cookies: async () => mockCookieStore, __esModule: true }
};

require.cache[require.resolve('./prisma')] = {
  id: require.resolve('./prisma'),
  filename: require.resolve('./prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
};

// Now import the module to test
const adminAuth = require('./admin-auth');
const { createAdminSession, getAdminSession, requireAdmin, revokeAdminSession } = adminAuth;

describe('Admin Authentication', () => {
  beforeEach(() => {
    mockCookieStore.set.mock.resetCalls();
    mockCookieStore.get.mock.resetCalls();
    mockCookieStore.delete.mock.resetCalls();
    mockPrisma.adminSession.create.mock.resetCalls();
    mockPrisma.adminSession.findUnique.mock.resetCalls();
    mockPrisma.adminSession.update.mock.resetCalls();
  });

  test('login valide - createAdminSession creates session and sets cookie', async () => {
    await createAdminSession();
    assert.strictEqual(mockPrisma.adminSession.create.mock.calls.length, 1);
    assert.strictEqual(mockCookieStore.set.mock.calls.length, 1);
    const callArgs = mockCookieStore.set.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], 'admin_session');
    assert.strictEqual(callArgs[2].httpOnly, true);
    assert.strictEqual(callArgs[2].sameSite, 'lax');
  });

  test('cookie absent - getAdminSession returns null', async () => {
    mockCookieStore.get.mock.mockImplementation(() => undefined);
    const session = await getAdminSession();
    assert.strictEqual(session, null);
  });

  test('token invalide - getAdminSession returns null', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'invalid_token' }));

    const session = await getAdminSession();
    assert.strictEqual(session, null);
  });

  test('token expiré - getAdminSession returns null', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'expired_token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementation(async () => ({
      id: '1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() - 10000),
      revokedAt: null
    }));

    const session = await getAdminSession();
    assert.strictEqual(session, null);
  });

  test('token révoqué - getAdminSession returns null', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'revoked_token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementation(async () => ({
      id: '1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: new Date()
    }));

    const session = await getAdminSession();
    assert.strictEqual(session, null);
  });

  test('session valide - getAdminSession returns session', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'valid_token' }));
    const validSession = {
      id: '1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: null
    };
    mockPrisma.adminSession.findUnique.mock.mockImplementation(async () => validSession);

    const session = await getAdminSession();
    assert.deepStrictEqual(session, validSession);
  });

  test('action admin sans session => refus (requireAdmin throws)', async () => {
    mockCookieStore.get.mock.mockImplementation(() => undefined);
    await assert.rejects(requireAdmin(), { message: 'Unauthorized' });
  });

  test('action admin avec session => autorisée (requireAdmin returns session)', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'valid_token' }));
    const validSession = { id: '1', expiresAt: new Date(Date.now() + 10000), revokedAt: null };
    mockPrisma.adminSession.findUnique.mock.mockImplementation(async () => validSession);

    const session = await requireAdmin();
    assert.deepStrictEqual(session, validSession);
  });

  test('logout révoque session et supprime le cookie', async () => {
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'valid_token' }));
    await revokeAdminSession();

    assert.strictEqual(mockPrisma.adminSession.update.mock.calls.length, 1);
    assert.strictEqual(mockCookieStore.delete.mock.calls.length, 1);
    assert.strictEqual(mockCookieStore.delete.mock.calls[0].arguments[0], 'admin_session');
  });

  test('session CLIENT/localStorage ne donne aucun accès admin', async () => {
    mockCookieStore.get.mock.mockImplementation((name: string) => {
      if (name === 'client_token') return { value: 'client_stuff' };
      return undefined;
    });
    const session = await getAdminSession();
    assert.strictEqual(session, null);
  });
});
