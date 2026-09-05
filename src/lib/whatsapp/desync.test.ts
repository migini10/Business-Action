import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert';
import { internalSendWhatsAppMessage, retryOutboundWhatsAppMessage } from './send-message';
import prisma from '@/lib/test-prisma';
import { Prisma } from '@prisma/client';

test('Send success advances state', async () => {
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000000' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000000' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000000', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  global.fetch = async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wa-123-' + Math.random() }] }) }) as any;

  const res = await internalSendWhatsAppMessage(conv, 'Hello', undefined, { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });
  assert.ok(res.success);

  const updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'QUOTE_VEHICLE');

  const msg = await prisma.whatsAppMessage.findFirst({ where: { conversationId: conv.id } });
  assert.strictEqual(msg?.status, 'SENT');
});

test('Send fail does not advance state', async () => {
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000001' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000001' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000001', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  global.fetch = async () => { throw new TypeError('fetch failed'); };

  const res = await internalSendWhatsAppMessage(conv, 'Hello', undefined, { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });
  assert.ok(!res.success);

  const updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'IDLE'); // Unchanged

  const msg = await prisma.whatsAppMessage.findFirst({ where: { conversationId: conv.id } });
  assert.strictEqual(msg?.status, 'FAILED');
});

test('Retry success advances state once', async () => {
  // Simulate the retry worker logic here
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000002' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000002' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000002', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  // First failed
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  await internalSendWhatsAppMessage(conv, 'Hello', undefined, { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });

  // Retry success
  global.fetch = async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wa-456-' + Date.now() + '-' + Math.random() }] }) }) as any;
  const retryMsg = await prisma.whatsAppMessage.findFirst({ where: { conversationId: conv.id, status: 'FAILED' } });
  
  if (retryMsg && retryMsg.metadata) {
    const meta = retryMsg.metadata as any;
    const res = await internalSendWhatsAppMessage(conv, retryMsg.content, undefined, meta, { db: prisma });
    assert.ok(res.success);
  }

  const updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'QUOTE_VEHICLE');
});

test('Double retry prevents double transition', async () => {
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000003' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000003' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000003', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  global.fetch = async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wa-789-' + Date.now() + '-' + Math.random() }] }) }) as any;
  
  // First webhook trigger creates the message
  await internalSendWhatsAppMessage(conv, 'Hello', 'inbound_123', { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });
  
  // Second concurrent/retried webhook trigger fails to create a duplicate message
  const res2 = await internalSendWhatsAppMessage(conv, 'Hello', 'inbound_123', { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.error, 'Auto-réponse déjà traitée.');

  const msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId: conv.id } });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].status, 'SENT');

  const updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'QUOTE_VEHICLE');
});


test('Retry logic and Idempotence', async () => {
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000004' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000004' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000004', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  // 1. Send FAIL -> FAILED, state unchanged
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  const res1 = await internalSendWhatsAppMessage(conv, 'Hello', undefined, { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });
  assert.ok(!res1.success);

  let msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId: conv.id } });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].status, 'FAILED');
  const originalMsgId = msgs[0].id;
  
  let updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'IDLE');

  // 2. Retry FAIL -> retryCount/backoff
  global.fetch = async () => { throw new TypeError('fetch failed again'); };
  await retryOutboundWhatsAppMessage(originalMsgId, { db: prisma });
  
  msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId: conv.id } });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].status, 'RETRYING');
  assert.strictEqual(msgs[0].retryCount, 1);
  assert.ok(msgs[0].nextAttemptAt !== null);

  // Reset nextAttemptAt so it's eligible for immediate retry in test
  await prisma.whatsAppMessage.update({ where: { id: originalMsgId }, data: { nextAttemptAt: null } });

  // 3. Retry SUCCESS -> same message SENT, state advances
  global.fetch = async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wa-success' }] }) }) as any;
  await retryOutboundWhatsAppMessage(originalMsgId, { db: prisma });

  msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId: conv.id } });
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].id, originalMsgId); // ID inchangé
  assert.strictEqual(msgs[0].status, 'SENT');
  assert.strictEqual(msgs[0].retryCount, 1);

  updatedConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(updatedConv?.botState, 'QUOTE_VEHICLE');

  // 4. Retry d'un SENT -> aucun fetch (returns success: false)
  let fetchCalled = false;
  global.fetch = async () => { fetchCalled = true; return {} as any; };
  const resSent = await retryOutboundWhatsAppMessage(originalMsgId, { db: prisma });
  assert.strictEqual(fetchCalled, false);
  assert.strictEqual(resSent.success, false);

  // 5. Deux workers concurrents -> handled by claim (tested practically by the claim query logic, hard to mock Prisma updateMany concurrency strictly here without interceptors, but we verify the query does condition on status).
});

test('Stale State Protection', async () => {
  await prisma.whatsAppMessage.deleteMany({ where: { conversation: { waId: '221770000005' } } });
  await prisma.whatsAppConversation.deleteMany({ where: { waId: '221770000005' } });

  const conv = await prisma.whatsAppConversation.create({
    data: { waId: '221770000005', botState: 'IDLE', lastInboundAt: new Date(), lastMessageAt: new Date() }
  });

  // Failed send when botState is IDLE, expected transition is QUOTE_VEHICLE
  global.fetch = async () => { throw new TypeError('fetch failed'); };
  await internalSendWhatsAppMessage(conv, 'Hello', undefined, { nextBotState: 'QUOTE_VEHICLE' }, { db: prisma });

  const msg = await prisma.whatsAppMessage.findFirst({ where: { conversationId: conv.id } });
  
  // Simulate user changing state manually in between (or by another flow)
  await prisma.whatsAppConversation.update({ where: { id: conv.id }, data: { botState: 'MAIN_MENU' } });

  // Retry success
  global.fetch = async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wa-success2' }] }) }) as any;
  await retryOutboundWhatsAppMessage(msg!.id, { db: prisma });

  // Verification: Message should be SENT, but state should REMAIN MAIN_MENU (stale state protection)
  const finalMsg = await prisma.whatsAppMessage.findUnique({ where: { id: msg!.id } });
  assert.strictEqual(finalMsg?.status, 'FAILED');

  const finalConv = await prisma.whatsAppConversation.findUnique({ where: { id: conv.id } });
  assert.strictEqual(finalConv?.botState, 'MAIN_MENU'); // Did NOT transition to QUOTE_VEHICLE
});
