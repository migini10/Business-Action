import prisma from '@/lib/prisma';
import { WhatsAppConversation, DocumentFlowChoice, Prisma } from '@prisma/client';

export async function recoverBotState(conversation: WhatsAppConversation): Promise<{ botState: string; isComplete: boolean }> {
  if (!conversation.activeDossierId) {
    const state = conversation.botState === 'HUMAN_SUPPORT' ? 'IDLE' : conversation.botState;
    return { botState: state, isComplete: true };
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: conversation.activeDossierId }
  });

  if (!dossier) {
    return { botState: 'IDLE', isComplete: true };
  }

  let flow = dossier.documentFlow;

  // LEGACY handling
  if (flow === 'NONE') {
    if (conversation.botState === 'WAITING_FOR_RECTO' || conversation.botState === 'WAITING_FOR_VERSO') {
      flow = 'CARTE_GRISE';
    } else if (conversation.botState === 'WAITING_FOR_CMC') {
      flow = 'CMC';
    } else {
      // Ambiguous legacy (e.g. IDLE + NONE) -> fallback to DOCUMENT_CHOICE
      return { botState: 'DOCUMENT_CHOICE', isComplete: false };
    }
  }

  const documents = await prisma.dossierDocument.findMany({
    where: { dossierId: dossier.id }
  });

  if (flow === 'CMC') {
    const hasCmc = documents.some(d => d.type === 'CMC');
    if (hasCmc) return { botState: 'IDLE', isComplete: true };
    return { botState: 'WAITING_FOR_CMC', isComplete: false };
  }

  if (flow === 'CARTE_GRISE') {
    const hasRecto = documents.some(d => d.type === 'CARTE_GRISE' && d.side === 'RECTO');
    const hasVerso = documents.some(d => d.type === 'CARTE_GRISE' && d.side === 'VERSO');

    if (hasVerso) return { botState: 'IDLE', isComplete: true };
    if (hasRecto) return { botState: 'WAITING_FOR_VERSO', isComplete: false };
    return { botState: 'WAITING_FOR_RECTO', isComplete: false };
  }

  return { botState: 'DOCUMENT_CHOICE', isComplete: false };
}
