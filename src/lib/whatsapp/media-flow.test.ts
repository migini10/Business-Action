/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Set directly (not just via the @/lib/supabase require.cache mock below): route
// modules required before that mock is installed can retain a real, unmocked
// reference, so getDossierDocumentsBucket() must succeed either way.
process.env.SUPABASE_STORAGE_BUCKET = 'dossier_documents_dev';

// Mock Prisma
require.cache[require.resolve('next/server')] = {
  id: require.resolve('next/server'),
  filename: require.resolve('next/server'),
  loaded: true,
  exports: {
    NextRequest: class NextRequest {},
    NextResponse: class NextResponse {
      constructor(body?: any, init?: any) {
        (this as any).status = init?.status || 200;
      }
      static json(body: any, init?: any) {
        return { body, status: init?.status || 200, json: async () => body };
      }
    },
    after: mock.fn(async (cb: any) => {
      await cb();
    })
  },
} as any;
const mockPrisma = {
  whatsAppConversation: {
    findUnique: mock.fn(async (args?: any): Promise<any> => null),
    updateMany: mock.fn(async (args?: any): Promise<any> => ({ count: 1 })),
    update: mock.fn(async (args?: any): Promise<any> => ({})),
  },
  dossier: {
    create: mock.fn(async (args?: any): Promise<any> => ({ id: 'dossier-id', numeroDossier: 'DOS-1234' })),
  },
  user: {
    findUnique: mock.fn(async (args?: any): Promise<any> => null),
    create: mock.fn(async (args?: any): Promise<any> => ({ id: 'user-id' })),
  },
  $transaction: mock.fn(async (cb: any): Promise<any> => cb(mockPrisma)),
  $queryRaw: mock.fn(async (args?: any): Promise<any[]> => []),
  whatsAppMessage: {
    upsert: mock.fn(async (args?: any): Promise<any> => ({})),
    findMany: mock.fn(async () => []),
    updateMany: mock.fn(async () => ({ count: 0 })),
    update: mock.fn(async () => ({}))
  },
  mediaStaging: {
    upsert: mock.fn(async (args?: any): Promise<any> => ({})),
    update: mock.fn(async (args?: any): Promise<any> => ({})),
  }
};

let jobsToReturn: any[] = [];
mockPrisma.$queryRaw.mock.mockImplementation(async () => jobsToReturn);

const originalFetch = global.fetch;
global.fetch = mock.fn(async (url: any) => {
  if (url.toString().includes('graph.facebook.com')) {
    if (url.toString().endsWith('/failed_media')) {
      return { ok: false, statusText: 'Bad Request' };
    }
    return {
      ok: true,
      json: async () => ({ url: 'mocked-url', mime_type: 'image/jpeg', file_size: 1000 }),
      arrayBuffer: async () => new ArrayBuffer(10),
    };
  }
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(10) };
}) as any;

// Mock dependencies
const mockSendMessage = {
  internalSendWhatsAppMessage: mock.fn(async (conv?: any, text?: any, msgId?: any): Promise<void> => {}),
};

const mockSupabase = {
  storage: {
    from: mock.fn((bucket?: any): any => ({
      upload: mock.fn(async (path?: any, data?: any, opts?: any): Promise<any> => ({ data: {}, error: null })),
    })),
  },
};

require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true },
} as any;

require.cache[require.resolve('@/lib/whatsapp/send-message')] = {
  id: require.resolve('@/lib/whatsapp/send-message'),
  filename: require.resolve('@/lib/whatsapp/send-message'),
  loaded: true,
  exports: mockSendMessage,
} as any;

require.cache[require.resolve('@/lib/supabase')] = {
  id: require.resolve('@/lib/supabase'),
  filename: require.resolve('@/lib/supabase'),
  loaded: true,
  exports: { getSupabase: () => mockSupabase, getDossierDocumentsBucket: () => 'dossier_documents_dev' },
} as any;

const { handleQuoteFlow } = require('../customer-service/quote-flow');
const { QUOTE_RESPONSES } = require('../customer-service/quote-responses');

describe('Media Flow Tests', () => {
  beforeEach(() => {
    mockPrisma.whatsAppConversation.updateMany.mock.resetCalls();
    mockPrisma.whatsAppConversation.update.mock.resetCalls();
    mockSendMessage.internalSendWhatsAppMessage.mock.resetCalls();
  });

  it('CONFIRM -> DOCUMENT_CHOICE', async () => {
    const conv = { id: 'conv-1', waId: '123', botState: 'QUOTE_CONFIRM', draftQuote: { typeVehicule: 'PARTICULIER' } };
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const response = await handleQuoteFlow(conv as any, '1', 'fr');
    
    assert.ok((response as any)?.text?.includes(QUOTE_RESPONSES.fr.DOCUMENT_CHOICE_PROMPT));
    
    // updateMany for atomic state transition
    assert.strictEqual(mockPrisma.whatsAppConversation.updateMany.mock.calls.length, 1);
    assert.deepStrictEqual(mockPrisma.whatsAppConversation.updateMany.mock.calls[0].arguments[0], {
      where: { id: 'conv-1', activeDossierId: null, botState: 'QUOTE_CONFIRM' },
      data: { activeDossierId: 'dossier-id' }
    });

    
  });

  it('choix 1 -> WAITING_FOR_RECTO + message recto', async () => {
    const conv = { id: 'conv-1', botState: 'DOCUMENT_CHOICE' };
    const response = await handleQuoteFlow(conv as any, '1', 'fr');
    
    assert.deepStrictEqual(response, { text: QUOTE_RESPONSES.fr.WAITING_RECTO_PROMPT, nextBotState: 'WAITING_FOR_RECTO' });
  });

  it('choix 2 -> WAITING_FOR_CMC + message CMC', async () => {
    const conv = { id: 'conv-1', botState: 'DOCUMENT_CHOICE' };
    const response = await handleQuoteFlow(conv as any, '2', 'fr');
    
    assert.deepStrictEqual(response, { text: QUOTE_RESPONSES.fr.WAITING_CMC_PROMPT, nextBotState: 'WAITING_FOR_CMC' });
  });

  it('choix invalide -> reste DOCUMENT_CHOICE', async () => {
    const conv = { id: 'conv-1', botState: 'DOCUMENT_CHOICE' };
    const response = await handleQuoteFlow(conv as any, 'invalid', 'fr');
    
    assert.strictEqual(response, QUOTE_RESPONSES.fr.DOCUMENT_CHOICE_INVALID);
    assert.strictEqual(mockPrisma.whatsAppConversation.update.mock.calls.length, 0); // No state change
  });

  it('RECTO réussi -> WAITING_FOR_VERSO + message verso', async () => {
    jobsToReturn = [{ id: 'job-1', source: 'WHATSAPP', mediaId: 'valid_media', waConversationId: 'conv-1', expectedSlot: 'CARTE_GRISE_RECTO' }];
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementationOnce(async () => ({ id: 'conv-1', botState: 'WAITING_FOR_RECTO' }));
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const { GET } = require('../../app/api/cron/worker/route');
    const mockReq = { headers: { get: () => 'Bearer unit-test-cron-secret' } };
    process.env.CRON_SECRET = 'unit-test-cron-secret';
    await GET(mockReq);

    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 1);
    assert.deepStrictEqual((mockSendMessage.internalSendWhatsAppMessage.mock.calls[0].arguments as any)[3], { nextBotState: 'WAITING_FOR_VERSO' });
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 1);
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls[0].arguments[1], QUOTE_RESPONSES.fr.WAITING_VERSO_PROMPT);
  });

  it('RECTO FAILED -> reste WAITING_FOR_RECTO', async () => {
    jobsToReturn = [{ id: 'job-1', source: 'WHATSAPP', mediaId: 'failed_media', waConversationId: 'conv-1', expectedSlot: 'CARTE_GRISE_RECTO' }];
    
    const { GET } = require('../../app/api/cron/worker/route');
    const mockReq = { headers: { get: () => 'Bearer unit-test-cron-secret' } };
    process.env.CRON_SECRET = 'unit-test-cron-secret';
    await GET(mockReq);

    // The state transition logic is inside the `try` block that succeeds. If download fails, no updateMany is called.
    assert.strictEqual(mockPrisma.whatsAppConversation.updateMany.mock.calls.length, 0);
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 0);
  });

  it('VERSO success -> fin collecte (IDLE) + message confirmation', async () => {
    jobsToReturn = [{ id: 'job-1', source: 'WHATSAPP', mediaId: 'valid_media', waConversationId: 'conv-1', expectedSlot: 'CARTE_GRISE_VERSO' }];
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementationOnce(async () => ({ id: 'conv-1', botState: 'WAITING_FOR_VERSO' }));
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const { GET } = require('../../app/api/cron/worker/route');
    const mockReq = { headers: { get: () => 'Bearer unit-test-cron-secret' } };
    process.env.CRON_SECRET = 'unit-test-cron-secret';
    await GET(mockReq);

    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 1);
    assert.deepStrictEqual((mockSendMessage.internalSendWhatsAppMessage.mock.calls[0].arguments as any)[3], { nextBotState: 'IDLE' });
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 1);
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls[0].arguments[1], QUOTE_RESPONSES.fr.DOCUMENTS_RECEIVED);
  });

  it('CMC success -> fin collecte (IDLE) + message confirmation', async () => {
    jobsToReturn = [{ id: 'job-1', source: 'WHATSAPP', mediaId: 'valid_media', waConversationId: 'conv-1', expectedSlot: 'CMC' }];
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementationOnce(async () => ({ id: 'conv-1', botState: 'WAITING_FOR_CMC' }));
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
    
    const { GET } = require('../../app/api/cron/worker/route');
    const mockReq = { headers: { get: () => 'Bearer unit-test-cron-secret' } };
    process.env.CRON_SECRET = 'unit-test-cron-secret';
    await GET(mockReq);

    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 1);
    assert.deepStrictEqual((mockSendMessage.internalSendWhatsAppMessage.mock.calls[0].arguments as any)[3], { nextBotState: 'IDLE' });
  });

  it('retry même média -> aucune double transition', async () => {
    jobsToReturn = [{ id: 'job-1', source: 'WHATSAPP', mediaId: 'valid_media', waConversationId: 'conv-1', expectedSlot: 'CARTE_GRISE_RECTO' }];
    // Mock conv existing but botState already transitioned to VERSO!
    mockPrisma.whatsAppConversation.findUnique.mock.mockImplementationOnce(async () => ({ id: 'conv-1', botState: 'WAITING_FOR_VERSO' }));
    mockPrisma.whatsAppConversation.updateMany.mock.mockImplementationOnce(async () => ({ count: 0 })); // 0 rows updated!
    
    const { GET } = require('../../app/api/cron/worker/route');
    const mockReq = { headers: { get: () => 'Bearer unit-test-cron-secret' } };
    process.env.CRON_SECRET = 'unit-test-cron-secret';
    await GET(mockReq);

    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 0);
    // Since count is 0, internalSendWhatsAppMessage should NOT be called.
    assert.strictEqual(mockSendMessage.internalSendWhatsAppMessage.mock.calls.length, 0);
  });
});

