/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert';
import prisma from '@/lib/prisma';
import { handleTrackingStart, handleTrackingSelect } from './customer-service/tracking-flow';
import { TRACKING_RESPONSES } from './customer-service/tracking-responses';
import { Prisma } from '@prisma/client';

describe('Customer Service Auto - TRACKING (CUSTOMER-SERVICE-AUTO-004)', () => {
  let mockDossiers: any[] = [];
  let mockConversations: any = {};
  
  before(() => {
    const p = prisma as any;
    
    p.whatsAppConversation = {
      findUniqueOrThrow: mock.fn(async ({ where }: any) => {
        const conv = mockConversations[where.id];
        if (!conv) throw new Error('Not found');
        return JSON.parse(JSON.stringify(conv));
      }),
      update: mock.fn(async ({ where, data }: any) => {
        const conv = mockConversations[where.id];
        if (!conv) throw new Error('Not found');
        if (data.botState !== undefined) conv.botState = data.botState;
        if (data.trackingContext !== undefined) conv.trackingContext = data.trackingContext === Prisma.DbNull ? null : data.trackingContext;
        return JSON.parse(JSON.stringify(conv));
      }),
      updateMany: mock.fn(async ({ where, data }: any) => {
        const conv = mockConversations[where.id];
        if (conv && conv.botState === where.botState) {
          if (data.botState !== undefined) conv.botState = data.botState;
          if (data.trackingContext !== undefined) conv.trackingContext = data.trackingContext === Prisma.DbNull ? null : data.trackingContext;
          return { count: 1 };
        }
        return { count: 0 };
      })
    };

    p.dossier = {
      findMany: mock.fn(async ({ where }: any) => {
        return mockDossiers.filter(d => {
          if (where.phone && d.phone !== where.phone) return false;
          if (where.numeroDossier && d.numeroDossier !== where.numeroDossier) return false;
          return true;
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }),
      findFirst: mock.fn(async ({ where }: any) => {
        return mockDossiers.find(d => {
          if (where.phone && d.phone !== where.phone) return false;
          if (where.numeroDossier && d.numeroDossier !== where.numeroDossier) return false;
          return true;
        }) || null;
      })
    };
    
    p.$transaction = mock.fn(async (cb: any) => cb(prisma));
  });

  beforeEach(() => {
    mockConversations = {
      'alice-id': { id: 'alice-id', waId: '221770000001', language: 'fr', botState: 'IDLE', trackingContext: null },
      'bob-id': { id: 'bob-id', waId: '221770000002', language: 'fr', botState: 'IDLE', trackingContext: null }
    };
    
    mockDossiers = [
      { numeroDossier: 'DOS-1001-SN', phone: '+221770000001', typeVehicule: 'PARTICULIER', statut: 'EN_ATTENTE', createdAt: new Date('2023-01-01') },
      { numeroDossier: 'DOS-1002-SN', phone: '+221770000001', typeVehicule: 'UTILITAIRE', statut: 'EN_TRAITEMENT', createdAt: new Date('2023-01-02') },
      { numeroDossier: 'DOS-1003-SN', phone: '+221770000002', typeVehicule: 'POIDS_LOURD', statut: 'OFFRE_ENVOYEE', createdAt: new Date('2023-01-03') }
    ];
  });

  after(() => {
    mock.restoreAll();
  });

  describe('IDOR & Security (Isolation des dossiers)', () => {
    it('returns generic not found when Alice asks for Bob\'s dossier (valid format but third-party)', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingStart(conv, 'suivre DOS-1003-SN', 'fr');
      assert.strictEqual(res, TRACKING_RESPONSES.fr.NOT_FOUND);
      const findManyMock = (prisma.dossier.findMany as any).mock.calls;
      const lastCall = findManyMock[findManyMock.length - 1];
      assert.strictEqual(lastCall.arguments[0].where.numeroDossier, 'DOS-1003-SN');
      assert.strictEqual(lastCall.arguments[0].where.phone, '+221770000001'); // Forcefully filtered by Alice's phone
    });

    it('returns identical generic not found for non-existent dossier', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingStart(conv, 'Je veux suivre DOS-9999-SN', 'fr');
      assert.strictEqual(res, TRACKING_RESPONSES.fr.NOT_FOUND);
    });

    it('returns identical generic not found for malformed reference DOS-999999-SN', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingStart(conv, 'Je veux suivre DOS-999999-SN', 'fr');
      assert.strictEqual(res, TRACKING_RESPONSES.fr.NOT_FOUND);
      // Ensure findMany was NEVER called because we rejected it early as an invalid attempt
      // It shouldn't have executed a findMany for 'DOS-999999-SN' because it was caught by !specificRef
    });

    it('returns identical generic not found for malformed reference DOS-ABC-SN', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingStart(conv, 'Je veux suivre DOS-ABC-SN', 'fr');
      assert.strictEqual(res, TRACKING_RESPONSES.fr.NOT_FOUND);
    });
    
    it('returns only Alice\'s dossiers when she tracks without specifying reference', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingStart(conv, 'où en est mon dossier', 'fr');
      assert.strictEqual(res?.includes('DOS-1001-SN'), true);
      assert.strictEqual(res?.includes('DOS-1002-SN'), true);
      assert.strictEqual(res?.includes('DOS-1003-SN'), false);
    });
    
    it('returns Bob\'s single dossier directly', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'bob-id' } });
      const res = await handleTrackingStart(conv, 'où en est mon dossier', 'fr');
      assert.strictEqual(res?.includes('DOS-1003-SN'), true);
      assert.strictEqual(res?.includes('Offre envoyée'), true);
    });
  });

  describe('TRACK_SELECT State Flow (Multiple Dossiers)', () => {
    it('enters TRACK_SELECT state for Alice', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(conv.botState, 'IDLE');
      
      const res = await handleTrackingStart(conv, 'je veux suivre ma demande', 'fr');
      assert.strictEqual(res?.includes('plusieurs demandes'), true);
      
      const updatedConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(updatedConv.botState, 'TRACK_SELECT');
      const context = updatedConv.trackingContext as { references: string[] };
      assert.strictEqual(context.references.length, 2);
    });

    it('rejects invalid selection', async () => {
      // Must put conversation in state TRACK_SELECT first because state is reset
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      await handleTrackingStart(conv, 'je veux suivre', 'fr'); // sets TRACK_SELECT

      const updatedConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingSelect(updatedConv, '3', 'fr'); // out of bounds
      assert.strictEqual(res, TRACKING_RESPONSES.fr.INVALID_SELECTION);
      
      const finalConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(finalConv.botState, 'TRACK_SELECT');
    });

    it('returns status and resets state on valid selection', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      await handleTrackingStart(conv, 'je veux suivre', 'fr'); // sets TRACK_SELECT

      const updatedConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      const res = await handleTrackingSelect(updatedConv, '1', 'fr'); 
      assert.strictEqual(res?.includes('En cours de traitement'), true); // DOS-1002-SN
      
      const finalConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(finalConv.botState, 'IDLE');
      assert.strictEqual(finalConv.trackingContext, null);
    });
  });

  describe('Interruptions & Fallbacks', () => {
    it('allows human transfer during TRACK_SELECT', async () => {
      const conv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      await handleTrackingStart(conv, 'suivi', 'fr');
      
      let updatedConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(updatedConv.botState, 'TRACK_SELECT');
      
      const res = await handleTrackingSelect(updatedConv, 'je veux parler a un conseiller', 'fr');
      assert.strictEqual(res, TRACKING_RESPONSES.fr.HUMAN_TRANSFER);
      
      updatedConv = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: 'alice-id' } });
      assert.strictEqual(updatedConv.botState, 'IDLE'); // Reset
    });
  });
});
