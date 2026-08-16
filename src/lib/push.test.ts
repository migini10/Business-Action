/* eslint-disable */
// @ts-nocheck
import { test, describe, beforeEach, mock, afterEach } from 'node:test';
import assert from 'node:assert';

const mockCookieStore = {
  set: mock.fn(),
  get: mock.fn(),
  delete: mock.fn(),
};

const mockPrisma = {
  pushSubscription: {
    findMany: mock.fn(async () => []),
    upsert: mock.fn(async () => ({})),
    deleteMany: mock.fn(async () => ({})),
    delete: mock.fn(async () => ({})),
  },
  whatsAppMessage: {
    findFirst: mock.fn(async () => null),
    create: mock.fn(async () => ({})),
  },
  whatsAppConversation: {
    findUnique: mock.fn(async () => null),
    create: mock.fn(async () => ({ id: 'conv-123' })),
    update: mock.fn(async () => ({ id: 'conv-123' })),
  },
  dossier: {
    create: mock.fn(async () => ({ numeroDossier: 'DOS-TEST-SN' })),
    findMany: mock.fn(async () => []),
  }
};

const mockWebPush = {
  setVapidDetails: mock.fn(),
  sendNotification: mock.fn(async () => { return; }),
};

// Mock Next.js headers
require.cache[require.resolve('next/headers')] = {
  id: require.resolve('next/headers'),
  filename: require.resolve('next/headers'),
  loaded: true,
  exports: { cookies: async () => mockCookieStore, __esModule: true }
};

// Mock Prisma (using relative path to match resolution)
require.cache[require.resolve('./prisma')] = {
  id: require.resolve('./prisma'),
  filename: require.resolve('./prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
};

// Mock web-push
require.cache[require.resolve('web-push')] = {
  id: require.resolve('web-push'),
  filename: require.resolve('web-push'),
  loaded: true,
  exports: mockWebPush,
  default: mockWebPush,
  __esModule: true
};

const adminAuth = require('./admin-auth');
const { requireAdmin } = adminAuth;

// Mock requireAdmin globally if needed, but it's better to just mock adminSession.findUnique
mockPrisma.adminSession = {
  findUnique: mock.fn(async () => null)
};

const { POST: subscribePost } = require('../app/api/webhooks/push/subscribe/route');
const { POST: unsubscribePost } = require('../app/api/webhooks/push/unsubscribe/route');
const { POST: testPost } = require('../app/api/webhooks/push/test/route');
const { GET: vapidGet } = require('../app/api/webhooks/push/vapid-public-key/route');
const { sendPushNotificationSafe } = require('./push/send-push');

describe('PWA Push Notifications (PWA-001)', () => {
  beforeEach(() => {
    mockWebPush.sendNotification.mock.resetCalls();
    mockPrisma.pushSubscription.findMany.mock.resetCalls();
    mockPrisma.pushSubscription.upsert.mock.resetCalls();
    mockPrisma.pushSubscription.deleteMany.mock.resetCalls();
    mockPrisma.pushSubscription.delete.mock.resetCalls();
    mockPrisma.adminSession.findUnique.mock.resetCalls();
    mockCookieStore.get.mock.resetCalls();
    
    // Set VAPID vars for tests
    process.env.WEB_PUSH_PUBLIC_KEY = 'test-public';
    process.env.WEB_PUSH_PRIVATE_KEY = 'test-private';
  });

  afterEach(() => {
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
  });

  test('VAPID route: rejects sans session admin', async () => {
    const res = await vapidGet();
    assert.strictEqual(res.status, 401);
  });

  test('VAPID route: returns public key avec session admin', async () => {
    mockCookieStore.get.mock.mockImplementationOnce(() => ({ value: 'valid-token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementationOnce(async () => ({ id: '1', expiresAt: new Date(Date.now() + 10000) }));
    
    const res = await vapidGet();
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.publicKey, 'test-public');
  });

  test('Subscribe: rejects sans session admin', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({}) });
    const res = await subscribePost(req);
    assert.strictEqual(res.status, 401);
  });

  test('Subscribe: requires endpoint and keys', async () => {
    mockCookieStore.get.mock.mockImplementationOnce(() => ({ value: 'valid-token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementationOnce(async () => ({ id: '1', expiresAt: new Date(Date.now() + 10000) }));
    
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ endpoint: 'https://push.com' }) });
    const res = await subscribePost(req);
    assert.strictEqual(res.status, 400); // Missing keys
  });

  test('Unsubscribe: supprime avec endpoint', async () => {
    mockCookieStore.get.mock.mockImplementationOnce(() => ({ value: 'valid-token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementationOnce(async () => ({ id: '1', expiresAt: new Date(Date.now() + 10000) }));
    
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ endpoint: 'https://push.com' }) });
    const res = await unsubscribePost(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(mockPrisma.pushSubscription.deleteMany.mock.callCount(), 1);
  });

  test('Test Push: envoie via web-push', async () => {
    mockCookieStore.get.mock.mockImplementationOnce(() => ({ value: 'valid-token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementationOnce(async () => ({ id: '1', expiresAt: new Date(Date.now() + 10000) }));
    
    mockPrisma.pushSubscription.findMany.mock.mockImplementationOnce(async () => [{
      id: 'sub-1',
      endpoint: 'https://test.com',
      p256dh: 'p256',
      auth: 'auth',
    }]);

    await testPost(new Request('http://localhost', { method: 'POST' }));
    
    assert.strictEqual(mockWebPush.sendNotification.mock.callCount(), 1);
    const callArgs = mockWebPush.sendNotification.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0].endpoint, 'https://test.com');
  });
  
  test('sendPushNotificationSafe: handles 410 Gone en supprimant subscription', async () => {
    mockPrisma.pushSubscription.findMany.mock.mockImplementationOnce(async () => [{
      id: 'sub-expired',
      endpoint: 'https://expired.com',
      p256dh: 'p256',
      auth: 'auth',
    }]);

    mockWebPush.sendNotification.mock.mockImplementationOnce(async () => {
      const error = new Error('Gone');
      error.statusCode = 410;
      throw error;
    });

    const result = await sendPushNotificationSafe({ title: 'Test', body: 'Test' });
    assert.strictEqual(result, true); // It caught the error safely
    assert.strictEqual(mockPrisma.pushSubscription.delete.mock.callCount(), 1);
  });

  test('Panne Web Push non bloquante (catch general)', async () => {
    mockPrisma.pushSubscription.findMany.mock.mockImplementationOnce(async () => [{
      id: 'sub-1', endpoint: 'https://test.com', p256dh: 'p256', auth: 'auth'
    }]);

    mockWebPush.sendNotification.mock.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });

    const result = await sendPushNotificationSafe({ title: 'Test', body: 'Test' });
    assert.strictEqual(result, true); // Still returns true or false safely
    assert.strictEqual(mockPrisma.pushSubscription.delete.mock.callCount(), 0); // No delete on general error
  });
});

  test('Manifest: properties correct', async () => {
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    assert.strictEqual(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.name, 'Business Action');
    assert.strictEqual(manifest.short_name, 'Business Action');
    assert.strictEqual(manifest.start_url, '/admin');
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.icons.some(i => i.src === '/icon-192x192.png'), true);
    assert.strictEqual(manifest.icons.some(i => i.src === '/icon-512x512.png'), true);
  });

  test('Service Worker: sw.js exists and handles push', async () => {
    const fs = require('fs');
    const path = require('path');
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    assert.strictEqual(fs.existsSync(swPath), true);
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.strictEqual(swContent.includes("self.addEventListener('push'"), true);
    assert.strictEqual(swContent.includes("self.addEventListener('notificationclick'"), true);
  });
