/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { test, describe, beforeEach, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Setup require cache mocks
const mockPrisma = {
  whatsAppConversation: {
    upsert: mock.fn(async (args: any) => ({ id: 'conv_123', ...args.create })),
    findUnique: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    update: mock.fn(async () => ({})),
  },
  whatsAppMessage: {
    create: mock.fn(async () => ({})),
    findUnique: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    update: mock.fn(async () => ({})),
  },
  $transaction: mock.fn(async (cb: any) => {
    return cb(mockPrisma);
  }),
  adminSession: {
    findUnique: mock.fn(async () => null),
    create: mock.fn(async () => ({})),
    update: mock.fn(async () => ({}))
  }
} as any;

const mockCookieStore = {
  get: mock.fn(() => ({ value: 'valid_token' })),
  set: mock.fn(),
  delete: mock.fn(),
};

require.cache[require.resolve('next/headers')] = {
  exports: { cookies: async () => mockCookieStore, __esModule: true }
} as any;

// Removed dynamic adminSession assignment since it's now in the object

const mockAuth = {
  requireAdmin: mock.fn(async () => { return; })
};

require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
} as any;

require.cache[require.resolve('@/lib/admin-auth')] = {
  id: require.resolve('@/lib/admin-auth'),
  filename: require.resolve('@/lib/admin-auth'),
  loaded: true,
  exports: { requireAdmin: mockAuth.requireAdmin, __esModule: true }
} as any;

const { getWhatsAppConversations, getWhatsAppMessages, sendWhatsAppMessage } = require('../app/actions/whatsapp');
const { GET, POST } = require('../app/api/webhooks/whatsapp/route');

describe('WhatsApp Webhook & Admin Actions Tests', () => {
  const WHATSAPP_VERIFY_TOKEN = 'test_token';
  const WHATSAPP_APP_SECRET = 'test_secret';

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = WHATSAPP_VERIFY_TOKEN;
    process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_id';

    mockPrisma.whatsAppConversation.upsert.mock.resetCalls();
    mockPrisma.whatsAppConversation.findUnique.mock.resetCalls();
    mockPrisma.whatsAppConversation.findMany.mock.resetCalls();
    mockPrisma.whatsAppConversation.update.mock.resetCalls();
    mockPrisma.whatsAppMessage.create.mock.resetCalls();
    mockPrisma.whatsAppMessage.findUnique.mock.resetCalls();
    mockPrisma.whatsAppMessage.findMany.mock.resetCalls();
    mockPrisma.whatsAppMessage.update.mock.resetCalls();
    mockPrisma.adminSession.findUnique.mock.resetCalls();
    mockCookieStore.get.mock.resetCalls();
    mockAuth.requireAdmin.mock.resetCalls();

    // Default auth mock success
    mockAuth.requireAdmin.mock.mockImplementation(async () => { return; });
    mockCookieStore.get.mock.mockImplementation(() => ({ value: 'valid_token' }));
    mockPrisma.adminSession.findUnique.mock.mockImplementation(async () => ({ id: 'sess_1', expiresAt: new Date(Date.now() + 100000) }));
  });

  const generateSignature = (body: string) => {
    return 'sha256=' + crypto.createHmac('sha256', WHATSAPP_APP_SECRET).update(body).digest('hex');
  };

  test('Webhook: GET Subscribe - success', async () => {
    const req = new NextRequest('http://localhost/api?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=CHALLENGE_STRING');
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), 'CHALLENGE_STRING');
  });

  test('Webhook: GET Subscribe - invalid token', async () => {
    const req = new NextRequest('http://localhost/api?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=CHALLENGE_STRING');
    const res = await GET(req);
    assert.strictEqual(res.status, 403);
  });

  test('Webhook: POST - invalid signature', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=invalid' }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
  });

  test('Webhook: POST - unsupported type => no crash', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ type: 'image', image: {} }] } }] }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 0);
  });

  test('Webhook: POST - valid text message creates conversation and message', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: '123456789', profile: { name: 'John Doe' } }],
            messages: [{
              from: '123456789',
              id: 'wamid.123',
              timestamp: '1690000000',
              type: 'text',
              text: { body: 'Hello Admin' }
            }]
          }
        }]
      }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    assert.strictEqual(mockPrisma.whatsAppConversation.upsert.mock.calls.length, 1);
    const upsertArgs = mockPrisma.whatsAppConversation.upsert.mock.calls[0].arguments[0];
    assert.strictEqual(upsertArgs.where.waId, '123456789');
    assert.strictEqual(upsertArgs.create.displayName, 'John Doe');

    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    const createArgs = mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.data.waMessageId, 'wamid.123');
    assert.strictEqual(createArgs.data.content, 'Hello Admin');
    assert.strictEqual(createArgs.data.direction, 'INBOUND');
    assert.strictEqual(createArgs.data.status, 'RECEIVED');
  });

  test('Webhook: POST - duplicated message (P2002) is idempotent', async () => {
    // Mock create to throw P2002
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    });

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: '123', id: 'wamid.dup', timestamp: '1690000000', type: 'text', text: { body: 'Dup' } }] } }] }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200); // Idempotent, returns 200

    // Restore mock
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => ({}));
  });

  test('Webhook: POST - status update in order', async () => {
    mockPrisma.whatsAppMessage.findUnique.mock.mockImplementation(async () => ({
      waMessageId: 'wamid.1',
      status: 'SENT',
      metaTimestamp: new Date(1690000000000)
    }));

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1690000100' }] } }] }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls.length, 1);
    const updateArgs = mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.status, 'DELIVERED');
  });

  test('Webhook: POST - out of order status update (no regression)', async () => {
    mockPrisma.whatsAppMessage.findUnique.mock.mockImplementation(async () => ({
      waMessageId: 'wamid.1',
      status: 'READ',
      metaTimestamp: new Date(1690000200000) // newer timestamp
    }));

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1690000100' }] } }] }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls.length, 0); // Should not update!
  });

  test('Admin Action: sans session admin => refus', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => { throw new Error('Unauthorized'); });
    try {
      await sendWhatsAppMessage('conv_1', 'Hello');
      assert.fail('Should have thrown');
    } catch (e: any) {
      assert.strictEqual(e.message, 'Unauthorized');
    }
  });

  test('Admin Action: conversation inexistante => refus propre', async () => {
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementation(async () => null);
    const res = await sendWhatsAppMessage('conv_unknown', 'Hello');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Conversation introuvable.');
  });

  test('Admin Action: texte vide => refus', async () => {
    const res = await sendWhatsAppMessage('conv_1', '   ');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Le message ne peut pas être vide.');
  });

  test('Admin Action: fenêtre dépassée => blocage', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementation(async () => ({
      id: 'conv_1', waId: '123', lastInboundAt: oldDate
    }));
    const res = await sendWhatsAppMessage('conv_1', 'Hello');
    assert.strictEqual(res.success, false);
    assert.match(res.error as string, /fenêtre de 24h est expirée/);
  });

  test('Admin Action: fetch mocké erreur', async () => {
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementation(async () => ({
      id: 'conv_1', waId: '123', lastInboundAt: new Date()
    }));

    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: 'Meta Error' } })
    })) as any;

    const res = await sendWhatsAppMessage('conv_1', 'Hello');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Erreur lors de l\'envoi via Meta API.');

    // Check FAILED message was saved
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0].data.status, 'FAILED');

    global.fetch = originalFetch;
  });

  test('Admin Action: fetch mocké succès', async () => {
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementation(async () => ({
      id: 'conv_1', waId: '123', lastInboundAt: new Date()
    }));

    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.outbound.1' }] })
    })) as any;

    const res = await sendWhatsAppMessage('conv_1', 'Hello');
    assert.strictEqual(res.success, true);

    // Check SENT message was saved via transaction
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0].data.status, 'SENT');
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0].data.waMessageId, 'wamid.outbound.1');

    global.fetch = originalFetch;
  });
});
