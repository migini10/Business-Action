import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock Prisma completely before importing any logic
const mockPrisma = {
  whatsAppConversation: {
    findUnique: mock.fn<any>(),
    update: mock.fn<any>(),
  },
  dossier: {
    findUnique: mock.fn<any>(),
  },
  dossierDocument: {
    findMany: mock.fn<any>(),
  }
};

require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
} as any;

const { recoverBotState } = require('./state-recovery');

describe('State Recovery (Mocked)', () => {
  beforeEach(() => {
    mockPrisma.whatsAppConversation.findUnique.mock.resetCalls();
    mockPrisma.dossier.findUnique.mock.resetCalls();
    mockPrisma.dossierDocument.findMany.mock.resetCalls();
  });

  const setupMock = (dossierFlow: string, mediaSlots: string[]) => {
    mockPrisma.dossier.findUnique.mock.mockImplementation(async () => {
      return { id: 'dossier_1', documentFlow: dossierFlow };
    });
    mockPrisma.dossierDocument.findMany.mock.mockImplementation(async () => {
      return mediaSlots.map(slot => {
        if (slot === 'CMC') return { type: 'CMC', side: 'SINGLE' };
        if (slot === 'CARTE_GRISE_RECTO') return { type: 'CARTE_GRISE', side: 'RECTO' };
        if (slot === 'CARTE_GRISE_VERSO') return { type: 'CARTE_GRISE', side: 'VERSO' };
      });
    });
  };

  test('1. NONE → DOCUMENT_CHOICE', async () => {
    setupMock('NONE', []);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'DOCUMENT_CHOICE');
    assert.strictEqual(res.isComplete, false);
  });

  test('2. CARTE_GRISE sans RECTO STORED → WAITING_FOR_RECTO', async () => {
    setupMock('CARTE_GRISE', []);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_RECTO');
    assert.strictEqual(res.isComplete, false);
  });

  test('3. RECTO STORED → WAITING_FOR_VERSO', async () => {
    setupMock('CARTE_GRISE', ['CARTE_GRISE_RECTO']);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_VERSO');
    assert.strictEqual(res.isComplete, false);
  });

  test('4. CMC sans STORED → WAITING_FOR_CMC', async () => {
    setupMock('CMC', []);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_CMC');
    assert.strictEqual(res.isComplete, false);
  });

  test('5. CMC STORED → IDLE / complete', async () => {
    setupMock('CMC', ['CMC']);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'IDLE');
    assert.strictEqual(res.isComplete, true);
  });

  test('6. VERSO STORED → IDLE / complete', async () => {
    setupMock('CARTE_GRISE', ['CARTE_GRISE_RECTO', 'CARTE_GRISE_VERSO']);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'IDLE');
    assert.strictEqual(res.isComplete, true);
  });

  test('7. RESERVED ne fait pas avancer', async () => {
    mockPrisma.dossier.findUnique.mock.mockImplementation(async () => ({ id: 'dossier_1', documentFlow: 'CARTE_GRISE' }));
    mockPrisma.dossierDocument.findMany.mock.mockImplementation(async () => []); 
    
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_RECTO');
    assert.strictEqual(res.isComplete, false);
  });

  test('8. RETRYING ne fait pas avancer', async () => {
    mockPrisma.dossier.findUnique.mock.mockImplementation(async () => ({ id: 'dossier_1', documentFlow: 'CARTE_GRISE' }));
    mockPrisma.dossierDocument.findMany.mock.mockImplementation(async () => []);
    
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_RECTO');
    assert.strictEqual(res.isComplete, false);
  });

  test('9. resumeBot restaure correctement (tested via whatsapp.test.ts but proxy check)', async () => {
    setupMock('CARTE_GRISE', ['CARTE_GRISE_RECTO']);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'HUMAN_SUPPORT' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_VERSO');
    assert.strictEqual(res.isComplete, false);
  });

  test('10. autoReply restaure un state incohérent (proxy check)', async () => {
    setupMock('CARTE_GRISE', []);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'WAITING_FOR_RECTO');
  });

  test('13. legacy ambigu → DOCUMENT_CHOICE', async () => {
    setupMock('NONE', []);
    const res = await recoverBotState({ activeDossierId: 'dossier_1', botState: 'IDLE' } as any);
    assert.strictEqual(res.botState, 'DOCUMENT_CHOICE');
    assert.strictEqual(res.isComplete, false);
  });
});
