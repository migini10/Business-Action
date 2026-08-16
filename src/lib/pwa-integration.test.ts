/* eslint-disable */
// @ts-nocheck
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const mockPrisma = {
  whatsAppMessage: {
    findFirst: mock.fn(async () => null),
    create: mock.fn(async () => ({})),
  },
  user: {
    findUnique: mock.fn(async () => null),
  },
  whatsAppConversation: {
    findUnique: mock.fn(async () => null),
    create: mock.fn(async () => ({ id: 'conv-123' })),
    update: mock.fn(async () => ({ id: 'conv-123' })),
    upsert: mock.fn(async () => ({ id: 'conv-123' })),
    updateMany: mock.fn(async () => ({ count: 1 })),
  },
  $transaction: require('node:test').mock.fn(async (cb) => cb(mockPrisma)),
  dossier: {
    create: mock.fn(async () => ({ numeroDossier: 'DOS-TEST-SN', status: 'NOUVEAU', id: 'dos-1' })),
    findUnique: mock.fn(async () => null),
  },
  quoteDraft: {
    findUnique: mock.fn(async () => ({
      id: 'draft-1',
      conversationId: 'conv-123',
      vehiclePhotos: ['url'],
      cniPhoto: 'url',
      carteGrisePhoto: 'url',
      nineaPhoto: 'url',
      rcPhoto: 'url'
    })),
    delete: mock.fn(async () => ({})),
  }
};

require.cache[require.resolve('./prisma')] = {
  id: require.resolve('./prisma'),
  filename: require.resolve('./prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
};

require.cache[require.resolve('@supabase/supabase-js')] = {
  id: require.resolve('@supabase/supabase-js'),
  filename: require.resolve('@supabase/supabase-js'),
  loaded: true,
  exports: {
    createClient: mock.fn(() => ({
      storage: {
        from: mock.fn(() => ({
          upload: mock.fn(async () => ({ data: { path: 'path' }, error: null })),
          getPublicUrl: mock.fn(() => ({ data: { publicUrl: 'http://test.com/img.jpg' } }))
        }))
      }
    })),
    __esModule: true
  }
};

const mockSendPush = {
  sendPushNotificationSafe: mock.fn(async () => true),
};
require.cache[require.resolve('./push/send-push')] = {
  id: require.resolve('./push/send-push'),
  filename: require.resolve('./push/send-push'),
  loaded: true,
  exports: mockSendPush,
  __esModule: true
};

const { POST: whatsappPost } = require('../app/api/webhooks/whatsapp/route');
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_key';
const { createDossier } = require('../app/actions/dossier');
const { handleQuoteFlow } = require('./customer-service/quote-flow');

describe('PWA Integration & Idempotency Tests', () => {
  const WHATSAPP_APP_SECRET = 'test_secret';

  beforeEach(() => {
    mockSendPush.sendPushNotificationSafe.mock.resetCalls();
    mockPrisma.whatsAppMessage.create.mock.resetCalls();
    mockPrisma.whatsAppConversation.upsert.mock.resetCalls();
    mockPrisma.dossier.create.mock.resetCalls();
    
    process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET;
  });

  const generateSignature = (body: string) => {
    return 'sha256=' + crypto.createHmac('sha256', WHATSAPP_APP_SECRET).update(body).digest('hex');
  };

  test('WhatsApp Inbound: exactly 1 push call for valid new message', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '123456789', id: 'wamid.123', type: 'text', text: { body: 'Hello' }
            }],
            contacts: [{ profile: { name: 'John Doe' }, wa_id: '123456789' }]
          }
        }]
      }]
    });

    const req = new Request('http://localhost', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    
    const res = await whatsappPost(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(mockSendPush.sendPushNotificationSafe.mock.callCount(), 1);
  });

  test('WhatsApp Inbound: 0 new push calls on replay (P2002 error)', async () => {
    // Simulate P2002 Unique Constraint violation
    mockPrisma.whatsAppMessage.create.mock.mockImplementationOnce(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0'
      });
    });

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{ from: '123456789', id: 'wamid.replay', type: 'text', text: { body: 'Hello' } }],
            contacts: [{ profile: { name: 'John Doe' }, wa_id: '123456789' }]
          }
        }]
      }]
    });

    const req = new Request('http://localhost', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });
    
    const res = await whatsappPost(req);
    assert.strictEqual(res.status, 200); // Handled gracefully
    assert.strictEqual(mockSendPush.sendPushNotificationSafe.mock.callCount(), 0); // NO PUSH!
    
    // Restore mock
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => ({}));
  });

  test('Dossier Creation: exactly 1 push call for successful creation', async () => {
    const fd = new FormData();
    fd.append('typeVehicule', 'Voiture');
    
    const res = await createDossier(fd);
    if (!res.success) {
      console.error('Dossier Error:', res.error);
    }
    assert.strictEqual(res.success, true);
    assert.strictEqual(mockSendPush.sendPushNotificationSafe.mock.callCount(), 1);
  });

  test('Quote Flow Idempotency: exactly 1 push call on first confirmation, fails cleanly on replay', async () => {
    // First call succeeds
    const conv = { id: 'conv-123', waId: '123', phone: '123', language: 'fr', botState: 'QUOTE_CONFIRM', draftQuote: { typeVehicule: 'Voiture' } };
    await handleQuoteFlow(conv, 'OUI', 'fr');
    assert.strictEqual(mockSendPush.sendPushNotificationSafe.mock.callCount(), 1);
    
    // Now simulate that the draft was already deleted (replay)
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 0 }));
    
    await handleQuoteFlow(conv, 'OUI', 'fr');
    
    // Push call count should still be exactly 1!
    assert.strictEqual(mockSendPush.sendPushNotificationSafe.mock.callCount(), 1);
  });
});
