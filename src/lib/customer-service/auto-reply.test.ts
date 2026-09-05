/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// 1. Définir le mock de Prisma
const mockPrisma = {
  whatsAppConversation: {
    update: mock.fn(async () => ({})),
    updateMany: mock.fn(async () => ({ count: 1 })),
  },
  whatsAppMessage: {
    create: mock.fn(async () => ({ id: 'fake_msg' })), update: mock.fn(async () => ({}))
  },
  dossier: {
    findMany: mock.fn(async () => []),
    findUnique: mock.fn(async () => null)
  },
  mediaStaging: {
    findMany: mock.fn(async () => [])
  },
  $transaction: mock.fn(async (arg) => Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma))
};

// 2. Injecter dans le cache CJS (car tsx compile en CJS)
require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
} as any;

// 3. Importer processAutoReply dynamiquement APRÈS avoir mocké le cache
const { processAutoReply } = require('./auto-reply');

describe('Auto-Reply State Machine (MAIN_MENU)', () => {
  let originalFetch: any;

  beforeEach(() => {
    mock.restoreAll();
    
    process.env.WHATSAPP_ACCESS_TOKEN = 'mock-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock-id';

    originalFetch = global.fetch;

    global.fetch = mock.fn(async () => {
      return { ok: true, json: async () => ({ messages: [{ id: 'mock-wamid' }] }) };
    }) as any;

    mockPrisma.whatsAppConversation.update.mock.resetCalls();
    mockPrisma.whatsAppConversation.updateMany.mock.resetCalls();
    mockPrisma.whatsAppMessage.create.mock.resetCalls();
    mockPrisma.dossier.findMany.mock.resetCalls();
    mockPrisma.$transaction.mock.resetCalls();
  });

  afterEach(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    global.fetch = originalFetch;
    mock.restoreAll();
  });

  const baseConv = { id: 'c1', waId: 'w1', language: 'fr', botState: 'IDLE', lastInboundAt: new Date() } as any;
  const inbound = { id: 'm1' } as any;

  it('GREETING -> transitions to MAIN_MENU', async () => {
    await processAutoReply({ ...baseConv }, inbound, 'Bonjour');
    
    const calls = mockPrisma.whatsAppConversation.update.mock.calls;
    const hasMainMenuUpdate = calls.some((c: any) => c.arguments[0]?.data?.botState === 'MAIN_MENU');
    assert.strictEqual(hasMainMenuUpdate, true, "Devrait passer en MAIN_MENU après un GREETING");
  });

  it('In MAIN_MENU -> 1 triggers QUOTE_REQUEST and returns to IDLE', async () => {
    await processAutoReply({ ...baseConv, botState: 'MAIN_MENU' }, inbound, '1');
    
    const calls = mockPrisma.whatsAppConversation.update.mock.calls;
    const hasIdleUpdate = calls.some((c: any) => c.arguments[0]?.data?.botState === 'QUOTE_VEHICLE');
    assert.strictEqual(hasIdleUpdate, true, "Devrait passer en QUOTE_VEHICLE");
    
    const fetchCalls = (global.fetch as any).mock.calls;
    assert.ok(fetchCalls.length > 0);
    const bodyStr = fetchCalls[fetchCalls.length - 1].arguments[1].body;
    assert.ok(bodyStr.includes('Quel type de véhicule'), "Doit envoyer le message de démarrage de devis");
  });

  it('In MAIN_MENU -> 2 triggers REQUEST_STATUS', async () => {
    await processAutoReply({ ...baseConv, botState: 'MAIN_MENU' }, inbound, '2');
    
    const fetchCalls = (global.fetch as any).mock.calls;
    const bodyStr = fetchCalls[fetchCalls.length - 1].arguments[1].body;
    assert.ok(bodyStr.includes('aucun dossier') || bodyStr.includes('Sélectionnez'), "Doit envoyer un message de tracking");
  });

  it('In MAIN_MENU -> 3 triggers HUMAN_SUPPORT', async () => {
    await processAutoReply({ ...baseConv, botState: 'MAIN_MENU' }, inbound, '3');
    
    const fetchCalls = (global.fetch as any).mock.calls;
    const bodyStr = fetchCalls[fetchCalls.length - 1].arguments[1].body;
    assert.ok(bodyStr.includes('transmise à un conseiller'), "Doit transférer à l'agent");
  });

  it('In MAIN_MENU -> invalid choice triggers error message and stays in MAIN_MENU', async () => {
    await processAutoReply({ ...baseConv, botState: 'MAIN_MENU' }, inbound, '5');
    
    const calls = mockPrisma.whatsAppConversation.update.mock.calls;
    const hasIdleUpdate = calls.some((c: any) => c.arguments[0]?.data?.botState === 'IDLE');
    assert.strictEqual(hasIdleUpdate, false, "Ne doit pas repasser en IDLE sur un choix invalide");
    
    const fetchCalls = (global.fetch as any).mock.calls;
    const bodyStr = fetchCalls[fetchCalls.length - 1].arguments[1].body;
    assert.ok(bodyStr.includes('Choix invalide'), "Doit envoyer le message d'erreur");
  });

  it('Outside MAIN_MENU -> 1 has no effect (UNKNOWN)', async () => {
    await processAutoReply({ ...baseConv, botState: 'IDLE' }, inbound, '1');
    
    const fetchCalls = (global.fetch as any).mock.calls;
    const bodyStr = fetchCalls[fetchCalls.length - 1].arguments[1].body;
    assert.ok(bodyStr.includes('reformuler votre question'), "Doit déclencher UNKNOWN FAQ");
  });

  it('IDLE with activeDossierId calls recoverBotState correctly', async () => {
    mockPrisma.whatsAppConversation.update.mock.resetCalls();
    await processAutoReply({ ...baseConv, botState: 'IDLE', activeDossierId: 'dossier_123' }, inbound, 'Test message');
    
    const calls = mockPrisma.whatsAppConversation.update.mock.calls;
    assert.ok(calls.length >= 1, "Devrait mettre à jour la conversation après recoverBotState");
    const updatedData = (calls[0] as any).arguments[0].data;
    assert.ok('activeDossierId' in updatedData || 'botState' in updatedData, "L'état de la conversation doit être synchronisé");
  });
});
