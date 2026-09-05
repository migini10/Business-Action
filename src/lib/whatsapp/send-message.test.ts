/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const mockPrisma = {
  whatsAppMessage: {
    updateMany: mock.fn<any>(),
    findUnique: mock.fn<any>(),
    update: mock.fn<any>(),
  },
  whatsAppConversation: {
    update: mock.fn<any>(),
  },
  $transaction: mock.fn<any>(async (ops: any) => Promise.all(ops)),
};

let retryOutboundWhatsAppMessage: any;
let globalFetch: any;
let consoleErrorSpy: any;

describe('send-message retry logic', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
    
    globalFetch = mock.fn(async () => {
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.123' }] })
      };
    });
    (global as any).fetch = globalFetch;
    consoleErrorSpy = mock.method(console, 'error');
    
    mockPrisma.whatsAppMessage.updateMany.mock.resetCalls();
    mockPrisma.whatsAppMessage.findUnique.mock.resetCalls();
    mockPrisma.whatsAppMessage.update.mock.resetCalls();
    mockPrisma.whatsAppConversation.update.mock.resetCalls();
    mockPrisma.$transaction.mock.resetCalls();

    const sendMsgMod = require('./send-message');
    retryOutboundWhatsAppMessage = sendMsgMod.retryOutboundWhatsAppMessage;
  });

  afterEach(() => {
    mock.restoreAll();
    delete require.cache[require.resolve('./send-message')];
  });

  it('PENDING récent -> pas de retry (claim retourne 0)', async () => {
    // claim retourne 0 quand aucun message correspond (ex: un PENDING récent non stale)
    mockPrisma.whatsAppMessage.updateMany.mock.mockImplementationOnce(async () => ({ count: 0 }));

    const res = await retryOutboundWhatsAppMessage('msg-1', { db: mockPrisma });
    
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Message non éligible au retry ou déjà en cours.');
    assert.strictEqual(mockPrisma.whatsAppMessage.findUnique.mock.callCount(), 0);
  });

  it('PENDING stale -> retry réussi -> SENT + WAITING_FOR_VERSO', async () => {
    mockPrisma.whatsAppMessage.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const mockDbMsg = {
      id: 'msg-1',
      content: 'Hello',
      retryCount: 0,
      status: 'PENDING',
      metadata: { expectedBotState: 'WAITING_FOR_RECTO', nextBotState: 'WAITING_FOR_VERSO' },
      conversation: {
        id: 'conv-1',
        waId: '221770000000',
        botState: 'WAITING_FOR_RECTO' // correspond à expectedBotState
      }
    };
    mockPrisma.whatsAppMessage.findUnique.mock.mockImplementationOnce(async () => mockDbMsg);

    const res = await retryOutboundWhatsAppMessage('msg-1', { db: mockPrisma });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.messageId, 'msg-1');
    assert.strictEqual(res.waMessageId, 'wamid.123');

    // Vérifie le fetch
    assert.strictEqual(globalFetch.mock.callCount(), 1);
    const fetchArgs = globalFetch.mock.calls[0].arguments;
    assert.strictEqual(fetchArgs[0], 'https://graph.facebook.com/v17.0/12345/messages');
    
    // Vérifie le transaction (SENT + botState)
    assert.strictEqual(mockPrisma.$transaction.mock.callCount(), 1);
    
    // Extract update arguments
    const updateMsgArg = mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateMsgArg.where.id, 'msg-1');
    assert.strictEqual(updateMsgArg.data.status, 'SENT');
    
    const updateConvArg = mockPrisma.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateConvArg.where.id, 'conv-1');
    assert.strictEqual(updateConvArg.data.botState, 'WAITING_FOR_VERSO');
  });

  it('double worker -> un seul envoi (claim 0 pour le second)', async () => {
    let callCount = 0;
    mockPrisma.whatsAppMessage.updateMany.mock.mockImplementation(async () => {
      callCount++;
      return { count: callCount === 1 ? 1 : 0 };
    });

    mockPrisma.whatsAppMessage.findUnique.mock.mockImplementation(async () => ({
      id: 'msg-1', content: 'Hello', retryCount: 0, status: 'PENDING',
      metadata: {}, conversation: { id: 'conv-1', botState: 'IDLE' }
    }));

    const res1 = await retryOutboundWhatsAppMessage('msg-1', { db: mockPrisma });
    const res2 = await retryOutboundWhatsAppMessage('msg-1', { db: mockPrisma });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error, 'Message non éligible au retry ou déjà en cours.');
    assert.strictEqual(globalFetch.mock.callCount(), 1);
  });

  it('échec Meta -> état reste WAITING_FOR_RECTO', async () => {
    mockPrisma.whatsAppMessage.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const mockDbMsg = {
      id: 'msg-1',
      content: 'Hello',
      retryCount: 0,
      status: 'PENDING',
      metadata: { expectedBotState: 'WAITING_FOR_RECTO', nextBotState: 'WAITING_FOR_VERSO' },
      conversation: {
        id: 'conv-1',
        waId: '221770000000',
        botState: 'WAITING_FOR_RECTO'
      }
    };
    mockPrisma.whatsAppMessage.findUnique.mock.mockImplementationOnce(async () => mockDbMsg);

    globalFetch.mock.mockImplementationOnce(async () => {
      return { ok: false, json: async () => ({ error: 'Bad Request' }) };
    });

    const res = await retryOutboundWhatsAppMessage('msg-1', { db: mockPrisma });

    assert.strictEqual(res.success, false);
    
    // Le botState ne doit pas changer
    assert.strictEqual(mockPrisma.whatsAppConversation.update.mock.callCount(), 0);
    
    // Le statut passe à RETRYING
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.callCount(), 1);
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0].data.status, 'RETRYING');
    assert.strictEqual(mockPrisma.whatsAppMessage.update.mock.calls[0].arguments[0].data.retryCount, 1);

    assert.strictEqual(consoleErrorSpy.mock.callCount(), 1);
    const loggedError = JSON.parse(consoleErrorSpy.mock.calls[0].arguments[0]);
    assert.strictEqual(loggedError.event, 'META_API_ERROR_RETRY');
    assert.strictEqual(loggedError.errorMessage, undefined);
    assert.strictEqual(loggedError.fbtraceId, 'ABSENT');
    assert.strictEqual(Object.keys(loggedError).includes('WHATSAPP_ACCESS_TOKEN'), false);
  });
});
