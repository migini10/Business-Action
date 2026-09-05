import { test, describe, mock, before } from 'node:test';
import assert from 'node:assert';
import { WhatsAppConversation, Prisma } from '@prisma/client';

import realPrisma from '@/lib/prisma';

let handleQuoteFlow: any;

// Setup mock methods on the singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = realPrisma as any;
p.whatsAppConversation = p.whatsAppConversation || {};
p.whatsAppConversation.update = mock.fn(async () => ({}));
p.whatsAppConversation.updateMany = mock.fn(async () => ({ count: 1 }));
p.dossier = p.dossier || {};
p.dossier.create = mock.fn(async () => ({ numeroDossier: 'DOS-TEST-SN' }));
p.user = p.user || {};
p.user.findUnique = mock.fn(async () => null);
p.user.create = mock.fn(async (args: any) => ({ id: 'usr-new-id', ...args.data }));
p.$transaction = mock.fn(async (cb: any) => cb(p));

describe('Customer Service Auto - QUOTE FLOW (CUSTOMER-SERVICE-AUTO-002)', () => {

  before(async () => {
    // mock.module crashes with Invalid URL in tsx for local files, so we mutate the singleton directly.
    const mod = await import('./customer-service/quote-flow');
    handleQuoteFlow = mod.handleQuoteFlow;
  });

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
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Quel type de véhicule/);
    
    
    assert.strictEqual((result as any).nextBotState, 'QUOTE_VEHICLE');
  });

  test('Select vehicle (QUOTE_VEHICLE -> QUOTE_CONFIRM) - FR', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '2', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /véhicule utilitaire/);
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Souhaitez-vous envoyer/);

    
    const updateArgs = p.whatsAppConversation.update.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'QUOTE_CONFIRM');
    assert.strictEqual(updateArgs.data.draftQuote.typeVehicule, 'UTILITAIRE');
  });

  test('Select vehicle - invalid input', async () => {
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'bonjour', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Veuillez répondre par 1, 2, 3, 4 ou 5/);
  });

  test('Confirm and create (QUOTE_CONFIRM -> DOCUMENT_CHOICE)', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    p.dossier.create.mock.resetCalls();

    const conv = {
      ...baseConv,
      botState: 'QUOTE_CONFIRM',
      draftQuote: { typeVehicule: 'UTILITAIRE' }
    } as unknown as WhatsAppConversation;

    const result = await handleQuoteFlow(conv, 'oui', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /DOS-TEST-SN/);

    // Check updateMany was called (atomic lock)
    assert.strictEqual(p.whatsAppConversation.updateMany.mock.calls.length, 1);
    const updateManyArgs = p.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateManyArgs.where.botState, 'QUOTE_CONFIRM');
    assert.strictEqual((result as any).nextBotState, 'DOCUMENT_CHOICE');

    // Check dossier creation
    assert.strictEqual(p.dossier.create.mock.calls.length, 1);
    const createArgs = p.dossier.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.data.phone, '+221771234567');
    assert.strictEqual(createArgs.data.typeVehicule, 'UTILITAIRE');
  });

  test('Idempotency / Concurrency on Confirm (Two simultaneous YES)', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();

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
    const successResult = [res1, res2].find(r => (typeof r === 'string' ? r : r?.text)?.includes('DOS-TEST-SN'));
    const concurrentResult = [res1, res2].find(r => (typeof r === 'string' ? r : r?.text)?.includes('déjà en cours'));

    assert.ok(successResult);
    assert.ok(concurrentResult);

    // RESTORE MOCK
    p.whatsAppConversation.updateMany.mock.mockImplementation(async () => ({ count: 1 }));
  });

  test('Cancel command', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'annuler', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /annulée/);
    
    assert.strictEqual((result as any).nextBotState, 'IDLE');
  });

  test('Restart command', async () => {
    p.whatsAppConversation.update.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_CONFIRM' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'recommencer', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Quel type de véhicule/);
    
    assert.strictEqual((result as any).nextBotState, 'QUOTE_VEHICLE');
  });

  test('Human transfer command (text)', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'je veux parler à un humain', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Votre demande a été transmise à un conseiller/);
    const updateArgs = p.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'HUMAN_SUPPORT');
  });

  test('Select 5 in QUOTE_VEHICLE -> HUMAN_SUPPORT', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_VEHICLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '5', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Votre demande a été transmise à un conseiller/);
    const updateArgs = p.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'HUMAN_SUPPORT');
    assert.strictEqual(updateArgs.data.draftQuote, Prisma.DbNull);
  });

  test('Select 4 in QUOTE_CONFIRM -> HUMAN_SUPPORT', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    const conv = { ...baseConv, botState: 'QUOTE_CONFIRM', draftQuote: { typeVehicule: 'UTILITAIRE' } } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, '4', 'fr');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Votre demande a été transmise à un conseiller/);
    const updateArgs = p.whatsAppConversation.updateMany.mock.calls[0].arguments[0];
    assert.strictEqual(updateArgs.data.botState, 'HUMAN_SUPPORT');
    assert.strictEqual(updateArgs.data.draftQuote, Prisma.DbNull);
  });

  test('Language WO', async () => {
    const conv = { ...baseConv, botState: 'IDLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'devis', 'wo');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /Ban xetu auto nga am/);
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /5\. Wax ak nit/);
  });

  test('Language EN', async () => {
    const conv = { ...baseConv, botState: 'IDLE' } as unknown as WhatsAppConversation;
    const result = await handleQuoteFlow(conv, 'quote', 'en');
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /What type of vehicle is your request about/);
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /5\. Talk to an advisor/);
  });

  test('Concurrent User.create -> P2002: no crash, reuses existing User', async () => {
    p.whatsAppConversation.updateMany.mock.resetCalls();
    p.dossier.create.mock.resetCalls();
    
    // Simulate user initially not found
    
    let findUniqueCallCount = 0;
    p.user.findUnique.mock.mockImplementation(async () => {
      findUniqueCallCount++;
      if (findUniqueCallCount === 1) return null; // First call: user not found
      return { id: 'usr-existing-id' }; // Second call: user found on fallback
    });

    p.user.create.mock.mockImplementation(async () => {
      const error = new Error('Unique constraint failed on the fields: (`phone`)');
      (error as any).code = 'P2002';
      throw error;
    });

    
    // Simulate concurrent creation P2002 error
    p.user.create.mock.mockImplementation(async () => {
      const error = new Error('Unique constraint failed on the fields: (`phone`)');
      (error as any).code = 'P2002';
      throw error;
    });

    // The catch block will then retry findUnique, so we return the user the second time
    /* replaced */

    const conv = {
      ...baseConv,
      botState: 'QUOTE_CONFIRM',
      draftQuote: { typeVehicule: 'PARTICULIER' }
    } as unknown as WhatsAppConversation;

    const result = await handleQuoteFlow(conv, 'oui', 'fr');
    
    assert.match((typeof result === "string" ? result : (result as any)?.text || ""), /DOS-TEST-SN/);
    assert.doesNotMatch((typeof result === "string" ? result : (result as any)?.text || ""), /Votre espace client a été créé automatiquement/); // no credentials on fallback
    
    assert.strictEqual(p.dossier.create.mock.calls.length, 1);
    const dossierCreateArgs = p.dossier.create.mock.calls[0].arguments[0];
    assert.strictEqual(dossierCreateArgs.data.clientId, 'usr-existing-id');

    // Restore mocks
    p.user.findUnique.mock.mockImplementation(async () => null);
    p.user.create.mock.mockImplementation(async (args: any) => ({ id: 'usr-new-id', ...args.data }));
  });
});
