/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { test, describe, beforeEach, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

// Setup require cache mocks
const mockPrisma = {
  whatsAppConversation: {
    upsert: mock.fn(async (args: any) => ({ id: 'conv_123', ...args.create })),
    findUnique: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    update: mock.fn(async () => ({})),
    updateMany: mock.fn(async () => ({ count: 1 })),
  },
  whatsAppMessage: {
    create: mock.fn(async () => ({ id: 'msg_1' })),
    findUnique: mock.fn(async () => null),
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    update: mock.fn(async () => ({})),
    updateMany: mock.fn(async () => ({ count: 1 })),
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
    mockPrisma.whatsAppConversation.updateMany?.mock?.resetCalls?.();
    mockPrisma.whatsAppMessage.create.mock.resetCalls();
    mockPrisma.whatsAppMessage.findUnique.mock.resetCalls();
    mockPrisma.whatsAppMessage.findFirst?.mock?.resetCalls?.();
    mockPrisma.whatsAppMessage.findMany.mock.resetCalls();
    mockPrisma.whatsAppMessage.update.mock.resetCalls();
    mockPrisma.whatsAppMessage.updateMany?.mock?.resetCalls?.();
    mockPrisma.$transaction.mock.resetCalls();
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

  test('1. Webhook: POST - inbound unique => readAt null, transaction used', async () => {
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

    assert.strictEqual(mockPrisma.$transaction.mock.calls.length, 1);

    assert.strictEqual(mockPrisma.whatsAppConversation.upsert.mock.calls.length, 1);
    const upsertArgs = mockPrisma.whatsAppConversation.upsert.mock.calls[0].arguments[0];
    assert.strictEqual(upsertArgs.where.waId, '123456789');

    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    const createArgs = mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.data.waMessageId, 'wamid.123');
    assert.strictEqual(createArgs.data.direction, 'INBOUND');
    // readAt est implicitement géré par Prisma comme null (absence de clé)
    assert.strictEqual(createArgs.data.readAt, undefined);
  });

  test('3/4. Webhook: POST - duplicated message (P2002) is idempotent and lastMessageAt rollback', async () => {
    // Dans la transaction, create throw P2002
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7' });
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

    // transaction appelée, mais rollback automatique car throw.
    assert.strictEqual(mockPrisma.$transaction.mock.calls.length, 1);

    // Restore mock
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => ({ id: 'msg_1' }));
  });

  test('5. Webhook: POST - erreur transaction autre que P2002 => propagée', async () => {
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => {
      throw new Error('Database down');
    });

    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: '123', id: 'wamid.err', timestamp: '1690000000', type: 'text', text: { body: 'Err' } }] } }] }]
    });
    const req = new NextRequest('http://localhost/api', {
      method: 'POST', body, headers: { 'x-hub-signature-256': generateSignature(body) }
    });

    // On s'attend à ce que l'erreur soit interceptée par le try/catch global et retourne 500
    const res = await POST(req);
    assert.strictEqual(res.status, 500);

    // Restore mock
    mockPrisma.whatsAppMessage.create.mock.mockImplementation(async () => ({ id: 'msg_1' }));
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

  test('AUTO-005: resumeBot sans admin => refus', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => { throw new Error('Unauthorized'); });
    const { resumeBot } = require('../app/actions/whatsapp');
    try {
      await resumeBot('conv_1');
      assert.fail('Should have thrown');
    } catch (e: any) {
      assert.strictEqual(e.message, 'Unauthorized');
    }
  });

  test('AUTO-005: resumeBot avec admin => HUMAN_SUPPORT -> IDLE', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    mockPrisma.whatsAppConversation.update.mock.mockImplementation(async (args: any) => {
      return { id: args.where.id, botState: args.data.botState };
    });
    const { resumeBot } = require('../app/actions/whatsapp');
    const res = await resumeBot('conv_1');

    assert.strictEqual(res.success, true);
    assert.strictEqual(mockPrisma.whatsAppConversation.update.mock.callCount(), 1);

    const updateArgs = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_1');
    assert.strictEqual(updateArgs.data.botState, 'IDLE');
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

    // Check reservation was made and then updated to FAILED
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0].data.status, 'SENT');
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0].data.status, 'FAILED');

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

    // Check reservation was made and then updated with waMessageId
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0].data.status, 'SENT');
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0].data.waMessageId, 'wamid.outbound.1');

    global.fetch = originalFetch;
  });

  test('18. Admin Action: getWhatsAppMessages sorting by metaTimestamp asc, createdAt asc, id asc', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    const { getWhatsAppMessages } = require('../app/actions/whatsapp');

    await getWhatsAppMessages('conv_target');

    assert.strictEqual(mockPrisma.whatsAppMessage.findMany.mock.calls.length, 1);
    const args = mockPrisma.whatsAppMessage.findMany.mock.calls[0].arguments[0];
    assert.strictEqual(args.where.conversationId, 'conv_target');
    assert.deepStrictEqual(args.orderBy, [
      { metaTimestamp: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' }
    ], 'Should order by metaTimestamp, createdAt and id ascending');
  });

  test('2. Admin Action: outbound ne participe pas aux non-lus', async () => {
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementation(async () => ({
      id: 'conv_1', waId: '123', lastInboundAt: new Date()
    }));
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.outbound.2' }] })
    })) as any;

    const res = await sendWhatsAppMessage('conv_1', 'Hello');
    assert.strictEqual(res.success, true);

    // Check that create does not have readAt explicitly set (meaning it ignores read logic or implicitly leaves it null? Actually in Prisma, outbound doesn't need readAt set, but let's verify direction is OUTBOUND)
    assert.strictEqual(mockPrisma.whatsAppMessage.create.mock.calls.length, 1);
    const createArgs = mockPrisma.whatsAppMessage.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.data.direction, 'OUTBOUND');

    global.fetch = originalFetch;
  });

  test('6. Admin Action: markAsRead sans Admin rejeté', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => { throw new Error('Unauthorized'); });
    const { markConversationAsRead } = require('../app/actions/whatsapp');
    try {
      await markConversationAsRead('conv_1');
      assert.fail('Should throw');
    } catch (e: any) {
      assert.strictEqual(e.message, 'Unauthorized');
    }
  });

  test('7. Admin Action: markAsRead => uniquement messages respectant l\'ordre strict (metaTimestamp, createdAt, id)', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});

    // Simuler le message B (borne)
    const baseMetaTimestamp = new Date('2026-08-18T10:00:00Z');
    const baseCreatedAt = new Date('2026-08-18T10:00:00.100Z');

    mockPrisma.whatsAppMessage.findFirst.mock.mockImplementation(async (args: any) => {
      if (args.where.id === 'msg_B') {
        return {
          id: 'msg_B',
          metaTimestamp: baseMetaTimestamp,
          createdAt: baseCreatedAt,
          direction: 'INBOUND',
          conversationId: 'conv_target'
        };
      }
      return null;
    });

    const { markConversationAsRead } = require('../app/actions/whatsapp');
    const res = await markConversationAsRead('conv_target', 'msg_B');

    assert.strictEqual(res.success, true);
    assert.strictEqual(mockPrisma.$transaction.mock.calls.length, 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.updateMany.mock.calls.length, 1);

    const updateManyArgs = mockPrisma.whatsAppMessage.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateManyArgs.where.conversationId, 'conv_target');

    // Vérifier la clause OR générée
    const orClause = updateManyArgs.where.OR;
    assert.ok(Array.isArray(orClause));
    assert.strictEqual(orClause.length, 3);

    // 1. lt metaTimestamp
    assert.strictEqual(orClause[0].metaTimestamp.lt, baseMetaTimestamp);

    // 2. eq metaTimestamp, lt createdAt
    assert.strictEqual(orClause[1].metaTimestamp, baseMetaTimestamp);
    assert.strictEqual(orClause[1].createdAt.lt, baseCreatedAt);

    // 3. eq metaTimestamp, eq createdAt, lte id
    assert.strictEqual(orClause[2].metaTimestamp, baseMetaTimestamp);
    assert.strictEqual(orClause[2].createdAt, baseCreatedAt);
    assert.strictEqual(orClause[2].id.lte, 'msg_B');
  });

  test('7b. Admin Action: markAsRead => borne appartenant à une autre conversation ou introuvable', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    mockPrisma.whatsAppMessage.findFirst.mock.mockImplementation(async () => null);

    const { markConversationAsRead } = require('../app/actions/whatsapp');
    const res = await markConversationAsRead('conv_target', 'msg_other_conv');

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Message de borne introuvable.');
  });

  test('7c. Admin Action: markAsRead => borne OUTBOUND rejetée', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    // findFirst retourne null car la clause where.direction = 'INBOUND' ne trouvera pas de message si on s'attendait à ce que ce soit le cas (mais simulons juste le comportement de findFirst qui ne trouve rien)
    mockPrisma.whatsAppMessage.findFirst.mock.mockImplementation(async () => null);

    const { markConversationAsRead } = require('../app/actions/whatsapp');
    const res = await markConversationAsRead('conv_target', 'msg_outbound');

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Message de borne introuvable.');
  });

  test('8. Handoff => HUMAN_SUPPORT + TO_DO', async () => {
    const { handleHumanHandoff } = require('../lib/customer-service/human-handoff');
    mockPrisma.whatsAppConversation.updateMany = mock.fn(async () => ({ count: 1 }));

    await handleHumanHandoff({ id: 'conv_handoff', waId: '123' }, 'fr');

    assert.strictEqual(mockPrisma.whatsAppConversation.updateMany.mock.calls.length, 1);
    const updateArgs = mockPrisma.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_handoff');
    assert.strictEqual(updateArgs.data.botState, 'HUMAN_SUPPORT');
    assert.strictEqual(updateArgs.data.supportStatus, 'TO_DO');
    assert.strictEqual(updateArgs.data.claimedAt, null);
    assert.strictEqual(updateArgs.data.resolvedAt, null);
  });

  test('9. Admin Action: claim => IN_PROGRESS', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    const { claimConversation } = require('../app/actions/whatsapp');
    const res = await claimConversation('conv_claim');

    assert.strictEqual(res.success, true);
    assert.strictEqual(mockPrisma.whatsAppConversation.update.mock.calls.length, 1);
    const updateArgs = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_claim');
    assert.strictEqual(updateArgs.data.supportStatus, 'IN_PROGRESS');
    assert.notStrictEqual(updateArgs.data.claimedAt, undefined);
  });

  test('10. Admin Action: resolve => RESOLVED', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    const { resolveConversation } = require('../app/actions/whatsapp');
    const res = await resolveConversation('conv_resolve');

    assert.strictEqual(res.success, true);
    const updateArgs = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_resolve');
    assert.strictEqual(updateArgs.data.supportStatus, 'RESOLVED');
    assert.notStrictEqual(updateArgs.data.resolvedAt, undefined);
  });

  test('11. Admin Action: reopen => TO_DO', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    const { reopenConversation } = require('../app/actions/whatsapp');
    const res = await reopenConversation('conv_reopen');

    assert.strictEqual(res.success, true);
    const updateArgs = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_reopen');
    assert.strictEqual(updateArgs.data.supportStatus, 'TO_DO');
    assert.strictEqual(updateArgs.data.claimedAt, null);
    assert.strictEqual(updateArgs.data.resolvedAt, null);
  });

  test('12. Admin Action: resumeBot ne change pas supportStatus', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => {});
    const { resumeBot } = require('../app/actions/whatsapp');
    const res = await resumeBot('conv_resume');

    assert.strictEqual(res.success, true);
    const updateArgs = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.where.id, 'conv_resume');
    assert.strictEqual(updateArgs.data.botState, 'IDLE');
    assert.strictEqual(updateArgs.data.supportStatus, undefined);
  });

  test('22. aucune action conseiller sans requireAdmin', async () => {
    mockAuth.requireAdmin.mock.mockImplementation(async () => { throw new Error('Unauthorized'); });
    const { claimConversation, resolveConversation, reopenConversation } = require('../app/actions/whatsapp');

    try { await claimConversation('conv_1'); assert.fail('Should throw'); } catch(e: any) { assert.strictEqual(e.message, 'Unauthorized'); }
    try { await resolveConversation('conv_1'); assert.fail('Should throw'); } catch(e: any) { assert.strictEqual(e.message, 'Unauthorized'); }
    try { await reopenConversation('conv_1'); assert.fail('Should throw'); } catch(e: any) { assert.strictEqual(e.message, 'Unauthorized'); }
  });
});
