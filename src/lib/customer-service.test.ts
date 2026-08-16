/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { detectLanguage } from './customer-service/language';
import { detectIntent } from './customer-service/intent';
import { getFaqResponse } from './customer-service/knowledge/faq';
import { processAutoReply } from './customer-service/auto-reply';
import prisma from '@/lib/prisma';
import { internalSendWhatsAppMessage } from '@/lib/whatsapp/send-message';

describe('Customer Service Auto - MVP', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  describe('1. Language Detection', () => {
    it('detects French', () => {
      assert.strictEqual(detectLanguage('bonjour je voudrais un devis'), 'fr');
      assert.strictEqual(detectLanguage('MERCI BEAUCOUP'), 'fr');
      assert.strictEqual(detectLanguage('oui s\'il vous plait'), 'fr');
    });

    it('detects English', () => {
      assert.strictEqual(detectLanguage('hello i need a quote'), 'en');
      assert.strictEqual(detectLanguage('how much does it cost?'), 'en');
      assert.strictEqual(detectLanguage('thanks'), 'en');
      assert.strictEqual(detectLanguage('What is the status of my request?'), 'en');
    });

    it('detects Wolof with or without special characters', () => {
      assert.strictEqual(detectLanguage('dama bëgg devis'), 'wo');
      assert.strictEqual(detectLanguage('dama begg devis'), 'wo'); // no accents
      assert.strictEqual(detectLanguage('ñaata la?'), 'wo');
      assert.strictEqual(detectLanguage('nata la?'), 'wo');
      assert.strictEqual(detectLanguage('naka mu awoo'), 'wo');
      assert.strictEqual(detectLanguage('Fumu tollu sama dossier ?'), 'wo');
      assert.strictEqual(detectLanguage('Famu tollu sama dossier ?'), 'wo');
      assert.strictEqual(detectLanguage('Ana sama dossier ?'), 'wo');
      assert.strictEqual(detectLanguage('Fumu toll sama mbir ?'), 'wo');
    });

    it('does not incorrectly detect Wolof from "salam" alone', () => {
      assert.strictEqual(detectLanguage('salam'), null);
    });

    it('returns null for ambiguous or unrecognized text', () => {
      assert.strictEqual(detectLanguage('asdasdasd'), null);
      assert.strictEqual(detectLanguage('???'), null);
    });

    it('allows explicit language change', () => {
      assert.strictEqual(detectLanguage('francais'), 'fr');
      assert.strictEqual(detectLanguage('wolof'), 'wo');
      assert.strictEqual(detectLanguage('english'), 'en');
    });
  });

  describe('2. Intent Detection', () => {
    it('detects QUOTE_REQUEST (FR/EN/WO)', () => {
      assert.strictEqual(detectIntent('je veux un devis'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('i need a quote'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('dama bëgg devis'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('commencer'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('start'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('tambali'), 'QUOTE_REQUEST');
    });

    it('detects FAQ_QUOTE', () => {
      assert.strictEqual(detectIntent('comment demander un devis'), 'FAQ_QUOTE');
      assert.strictEqual(detectIntent('how to get a quote'), 'FAQ_QUOTE');
      assert.strictEqual(detectIntent('quel est le prix ?'), 'FAQ_QUOTE');
      assert.strictEqual(detectIntent('how much for this?'), 'FAQ_QUOTE'); // Wait, questionScore=1, quoteScore=0 ? 'how much' -> 'how' is question, 'much' is nothing.
    });

    it('detects FAQ_SERVICES', () => {
      assert.strictEqual(detectIntent('quels services proposez vous'), 'FAQ_SERVICES');
      assert.strictEqual(detectIntent('what services do you offer'), 'FAQ_SERVICES');
      assert.strictEqual(detectIntent('ban service ngeen di def'), 'FAQ_SERVICES');
    });

    it('detects REQUEST_STATUS', () => {
      assert.strictEqual(detectIntent('où en est mon suivi'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('statut de mon dossier'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('where is my request'), 'REQUEST_STATUS');

      // FR exact & typos
      assert.strictEqual(detectIntent('Où en est mon dossier ?'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('ou en est mon dossier?'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('Je veux suivre mon dossier'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('Je veux suivre ma demande'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('Quel est le statut de mon dossier ?'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('ou en ai mon dosier'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('ou en est ma demende'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('je veu suivre mon dossier'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('quel est le statu de mon dossier'), 'REQUEST_STATUS');

      // EN variants
      assert.strictEqual(detectIntent('What is the status of my request?'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('Where is my request?'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('I want to track my request'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('whats the staus of my requst'), 'REQUEST_STATUS');

      // WO variants
      assert.strictEqual(detectIntent('famu tollu sama dossier'), 'REQUEST_STATUS');
      assert.strictEqual(detectIntent('ana sama mbir'), 'REQUEST_STATUS');
    });

    it('detects HUMAN_SUPPORT', () => {
      assert.strictEqual(detectIntent('je veux parler à un conseiller'), 'HUMAN_SUPPORT');
      assert.strictEqual(detectIntent('besoin d\'un humain'), 'HUMAN_SUPPORT');
      assert.strictEqual(detectIntent('agent please'), 'HUMAN_SUPPORT');
    });

    it('detects UNKNOWN', () => {
      assert.strictEqual(detectIntent('blablabla'), 'UNKNOWN');
      assert.strictEqual(detectIntent('12345'), 'UNKNOWN');
      assert.strictEqual(detectIntent('j\'ai une question'), 'UNKNOWN');
      assert.strictEqual(detectIntent('bonjour'), 'UNKNOWN');
      assert.strictEqual(detectIntent('voiture rouge'), 'UNKNOWN');
    });
  });

  describe('3. FAQ Response Logic', () => {
    it('returns FR response correctly', () => {
      const resp = getFaqResponse('fr', 'FAQ_QUOTE');
      assert.ok(resp?.includes('Je peux vous aider directement à faire une demande de devis'));
    });
    it('returns EN response correctly', () => {
      const resp = getFaqResponse('en', 'HUMAN_SUPPORT');
      assert.ok(resp?.includes('transferring you to an agent'));
    });
    it('returns WO response correctly', () => {
      const resp = getFaqResponse('wo', 'FAQ_SERVICES');
      assert.ok(resp?.includes('Ngir devis yi ñuy def ci Bizness Action'));
    });
    it('defaults to FR if language is null', () => {
      const resp = getFaqResponse(null, 'UNKNOWN');
      assert.ok(resp?.includes('Vous pouvez reformuler votre question'));
    });
  });

  describe('4. Idempotency & Orchestrator (Mocks)', () => {
    it('fails gracefully when Meta API fails, keeping webhook stable', async () => {
      // Mock global fetch to simulate Meta API failure
      const originalFetch = global.fetch;
      global.fetch = mock.fn(async () => {
        return { ok: false, json: async () => ({ error: 'Simulated API failure' }) };
      }) as any;

      const originalCreate = prisma.whatsAppMessage.create;
      const originalUpdate = prisma.whatsAppConversation.update;
      (prisma.whatsAppMessage as any).create = mock.fn(async () => ({ id: 'failed_msg_id' }));
      (prisma.whatsAppConversation as any).update = mock.fn(async () => ({}));

      const fakeConversation = { id: 'conv-1', waId: 'wa-1', language: 'fr', lastInboundAt: new Date() } as any;
      const fakeInbound = { id: 'inbound-1' } as any;

      // Ensure that processAutoReply doesn't crash
      try {
        await processAutoReply(fakeConversation, fakeInbound, 'bonjour');
      } catch (e) {
        assert.fail('processAutoReply should not throw if Meta fails');
      }

      (prisma.whatsAppMessage as any).create = originalCreate;
      (prisma.whatsAppConversation as any).update = originalUpdate;
      global.fetch = originalFetch;
    });

    it('idempotency: handles P2002 on autoReplyToId', async () => {
      const originalCreate = prisma.whatsAppMessage.create;
      (prisma.whatsAppMessage as any).create = mock.fn(async () => {
        throw { code: 'P2002' };
      });
      const fakeConversation = { id: 'conv-2', waId: 'wa-2', language: 'fr', lastInboundAt: new Date() } as any;
      const fakeInbound = { id: 'inbound-2' } as any;

      process.env.WHATSAPP_ACCESS_TOKEN = 'mock-token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock-id';

      const originalFetch = global.fetch;
      global.fetch = mock.fn(async () => {
        return { ok: true, json: async () => ({ messages: [{ id: 'mock-wamid' }] }) };
      }) as any;

      const result = await internalSendWhatsAppMessage(fakeConversation, 'text', 'inbound-2');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Auto-réponse déjà traitée.');

      global.fetch = originalFetch;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      (prisma.whatsAppMessage as any).create = originalCreate;
    });

    it('concurrent idempotency: reserves DB before calling Meta', async () => {
      const fakeConversation = { id: 'conv-concurrent', waId: 'wa-c', language: 'fr', lastInboundAt: new Date() } as any;
      const inboundId = 'inbound-concurrent';

      let fetchCalls = 0;
      const originalFetch = global.fetch;
      global.fetch = mock.fn(async () => {
        fetchCalls++;
        return { ok: true, json: async () => ({ messages: [{ id: 'mock-wamid' }] }) };
      }) as any;

      let createCalls = 0;
      const originalCreate = prisma.whatsAppMessage.create;
      const originalUpdate = prisma.whatsAppMessage.update;
      const originalConvUpdate = prisma.whatsAppConversation.update;

      (prisma.whatsAppMessage as any).create = mock.fn(async () => {
        createCalls++;
        if (createCalls === 1) return { id: 'reserved-id' };
        throw { code: 'P2002' };
      });
      (prisma.whatsAppMessage as any).update = mock.fn(async () => ({}));
      (prisma.whatsAppConversation as any).update = mock.fn(async () => ({}));

      const originalTransaction = prisma.$transaction;
      (prisma as any).$transaction = mock.fn(async (callback: any) => {
        // Just mock the execution of the callback and provide a dummy tx
        return callback(prisma);
      });

      process.env.WHATSAPP_ACCESS_TOKEN = 'mock-token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock-id';

      const [res1, res2] = await Promise.all([
        internalSendWhatsAppMessage(fakeConversation, 'text', inboundId),
        internalSendWhatsAppMessage(fakeConversation, 'text', inboundId)
      ]);

      // Only one execution should succeed
      assert.strictEqual(res1.success, true);
      assert.strictEqual(res2.success, false);
      assert.strictEqual(res2.error, 'Auto-réponse déjà traitée.');

      // Crucial: Meta API must be called exactly ONCE
      assert.strictEqual(fetchCalls, 1);

      global.fetch = originalFetch;
      (prisma.whatsAppMessage as any).create = originalCreate;
      (prisma.whatsAppMessage as any).update = originalUpdate;
      (prisma.whatsAppConversation as any).update = originalConvUpdate;
      (prisma as any).$transaction = originalTransaction;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    });
  });
});
