import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { handleQuoteFlow } from './customer-service/quote-flow';
import { WhatsAppConversation, Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';

// Setup mock methods on the singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
p.whatsAppConversation.update = mock.fn(async () => ({}));
p.whatsAppConversation.updateMany = mock.fn(async () => ({ count: 1 }));
p.dossier.create = mock.fn(async () => ({ numeroDossier: 'DOS-TEST-SN' }));
p.user.findUnique = mock.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
p.$transaction = mock.fn(async (cb: any) => cb(prisma));

describe('Customer Service Auto - QUOTE FLOW (CUSTOMER-SERVICE-AUTO-002)', () => {

  const baseConv: WhatsAppConversation = {
    id: 'conv-123',
    waId: '221771234567',
    botState: 'IDLE',
    draftQuote: Prisma.DbNull,
    displayName: 'Test',
    language: 'fr',
    lastInboundAt: new Date(),
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  } as unknown as WhatsAppConversation;

  test('Start quote flow (IDLE -> QUOTE_VEHICLE)', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const result = await handleQuoteFlow(baseConv, 'devis', 'fr');
    assert.match(result as string, /Quel type de véhicule/);
    assert.strictEqual(p.whatsAppConversation.update.mock.calls.length, 1);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'QUOTE_VEHICLE');
  });

  test('Select vehicle (QUOTE_VEHICLE -> QUOTE_CONFIRM) - FR', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '2', 'fr');
    assert.match(result as string, /véhicule utilitaire/);
    assert.match(result as string, /Souhaitez-vous envoyer/);
    
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'QUOTE_CONFIRM');
    assert.strictEqual(updateArgs.data.draftQuote.typeVehicule, 'UTILITAIRE');
  });

  test('Select vehicle - invalid input', async () => {
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'bonjour', 'fr');
    assert.match(result as string, /Veuillez répondre par 1, 2, 3, 4 ou 5/);
  });

  test('Confirm and create (QUOTE_CONFIRM -> IDLE)', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    
    const conv = { 
      ...baseConv, 
      botState: 'QUOTE_CONFIRM',
      draftQuote: { typeVehicule: 'UTILITAIRE' }
    } as unknown as WhatsAppConversation;
    
    const result = await handleQuoteFlow(conv, 'oui', 'fr');
    assert.match(result as string, /DOS-TEST-SN/);
    
    // Check updateMany was called (atomic lock)
    assert.strictEqual(p.whatsAppConversation.updateMany.mock.calls.length, 1);
    const updateManyArgs = p.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateManyArgs.where.botState, 'QUOTE_CONFIRM');
    assert.strictEqual(updateManyArgs.data.botState, 'IDLE');
    
    // Check dossier creation
    assert.strictEqual(p.dossier.create.mock.calls.length, 1);
    const createArgs = p.dossier.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.data.phone, '+221771234567');
    assert.strictEqual(createArgs.data.typeVehicule, 'UTILITAIRE');
  });

  test('Idempotency / Concurrency on Confirm (Two simultaneous YES)', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    
    let callCount = 0;
    p.whatsAppConversation.updateMany.mock.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { count: 1 }; // First one succeeds
      return { count: 0 }; // Second one fails
    });

    const conv = { 
      ...baseConv, 
      botState: 'QUOTE_CONFIRM',
      draftQuote: { typeVehicule: 'UTILITAIRE' }
    } as unknown as WhatsAppConversation;
    
    const [res1, res2] = await Promise.all([
      handleQuoteFlow(conv, 'oui', 'fr'),
      handleQuoteFlow(conv, 'oui', 'fr')
    ]);

    // One succeeds, one says already processed
    const successResult = [res1, res2].find(r => r?.includes('DOS-TEST-SN'));
    const concurrentResult = [res1, res2].find(r => r?.includes('déjà en cours'));
    
    assert.ok(successResult);
    assert.ok(concurrentResult);
  });

  test('Cancel command', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'annuler', 'fr');
    assert.match(result as string, /annulée/);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'IDLE');
  });

  test('Restart command', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_CONFIRM' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'recommencer', 'fr');
    assert.match(result as string, /Quel type de véhicule/);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'QUOTE_VEHICLE');
  });

  test('Human transfer command (text)', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'je veux parler à un humain', 'fr');
    assert.match(result as string, /conseiller va prendre le relais/);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'IDLE'); // Should reset flow
  });

  test('Select 5 in QUOTE_VEHICLE -> HUMAN_SUPPORT', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '5', 'fr');
    assert.match(result as string, /conseiller va prendre le relais/);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'IDLE');
    assert.strictEqual(updateArgs.data.draftQuote, Prisma.DbNull);
  });

  test('Select 4 in QUOTE_CONFIRM -> HUMAN_SUPPORT', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_CONFIRM', draftQuote: { typeVehicule: 'UTILITAIRE' } } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '4', 'fr');
    assert.match(result as string, /conseiller va prendre le relais/);
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'IDLE');
    assert.strictEqual(updateArgs.data.draftQuote, Prisma.DbNull);
  });

  test('Language WO', async () => {
    const conv = { ...baseConv, botState: 'IDLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'devis', 'wo');
    assert.match(result as string, /Ban xetu auto nga am/);
    assert.match(result as string, /5\. Wax ak nit/);
  });

  test('Language EN', async () => {
    const conv = { ...baseConv, botState: 'IDLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'quote', 'en');
    assert.match(result as string, /What type of vehicle is your request about/);
    assert.match(result as string, /5\. Talk to an advisor/);
  });
});
