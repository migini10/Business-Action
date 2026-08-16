import prisma from '@/lib/prisma';
import { WhatsAppConversation, Prisma, Dossier } from '@prisma/client';
import { SupportedLanguage } from './language';
import { TRACKING_RESPONSES } from './tracking-responses';
import { getTrackingStatusName } from './tracking-status';
import { normalizeWhatsAppIdentity } from './identity';
import { normalizeText } from './fuzzy-match';
import { getVehicleTypeName } from './quote-responses';

// Extract a dossier reference from the text (e.g. DOS-1234-SN)
export function extractDossierReference(text: string): string | null {
  const match = text.match(/DOS-\d{4}-SN/i);
  return match ? match[0].toUpperCase() : null;
}

export async function handleTrackingStart(
  conversation: WhatsAppConversation,
  text: string,
  lang: SupportedLanguage
): Promise<string | null> {
  const normalizedText = normalizeText(text);
  const responses = TRACKING_RESPONSES[lang];

  // Interruption logic (human transfer)
  const isHuman = ['humain', 'agent', 'conseiller', 'human', 'nit', 'advisor', 'personne'].some(k => normalizedText.includes(k));
  if (isHuman) {
    return responses.HUMAN_TRANSFER; // Don't change state since we are already in IDLE
  }

  const phoneStr = normalizeWhatsAppIdentity(conversation.waId);
  const specificRef = extractDossierReference(text);

  let dossiers: Dossier[] = [];

  if (specificRef) {
    // Both ref and phone in the SAME query (Anti-IDOR)
    dossiers = await prisma.dossier.findMany({
      where: {
        numeroDossier: specificRef,
        phone: phoneStr
      },
      take: 1
    });
  } else {
    // Find all dossiers for this phone
    dossiers = await prisma.dossier.findMany({
      where: {
        phone: phoneStr
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (dossiers.length === 0) {
    return responses.NOT_FOUND;
  }

  if (dossiers.length === 1) {
    const dossier = dossiers[0];
    const statusText = getTrackingStatusName(dossier.statut, lang);
    return responses.SINGLE_STATUS(dossier.numeroDossier, statusText, dossier.typeVehicule);
  }

  // Multiple dossiers
  // Save references in trackingContext
  const references = dossiers.map(d => d.numeroDossier);
  
  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      botState: 'TRACK_SELECT',
      trackingContext: { references }
    }
  });

  const listText = dossiers.map((d, idx) => `${idx + 1}. ${d.numeroDossier} — ${getVehicleTypeName(d.typeVehicule, lang)}`).join('\n');
  return responses.MULTIPLE_PROMPT(listText);
}

export async function handleTrackingSelect(
  conversation: WhatsAppConversation,
  text: string,
  lang: SupportedLanguage
): Promise<string | null> {
  const normalizedText = normalizeText(text);
  const responses = TRACKING_RESPONSES[lang];

  // Interruption logic
  const isHuman = ['humain', 'agent', 'conseiller', 'human', 'nit', 'advisor', 'personne'].some(k => normalizedText.includes(k));
  if (isHuman) {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE', trackingContext: Prisma.DbNull }
    });
    return responses.HUMAN_TRANSFER;
  }

  const isCancel = ['annuler', 'cancel', 'bayyi', 'bàyyi'].includes(normalizedText);
  if (isCancel) {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE', trackingContext: Prisma.DbNull }
    });
    return responses.CANCELLED;
  }

  const context = conversation.trackingContext as { references: string[] } | null;
  if (!context || !Array.isArray(context.references) || context.references.length === 0) {
    // Invalid context fallback
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE', trackingContext: Prisma.DbNull }
    });
    return responses.INVALID_SELECTION;
  }

  // Parse selection: either a number (1, 2, 3...) or a specific reference DOS-XXXX-SN
  let selectedRef: string | null = null;
  const specificRef = extractDossierReference(text);
  
  if (specificRef && context.references.includes(specificRef)) {
    selectedRef = specificRef;
  } else {
    // Try to parse as number
    const num = parseInt(text.trim(), 10);
    if (!isNaN(num) && num > 0 && num <= context.references.length) {
      selectedRef = context.references[num - 1];
    }
  }

  if (!selectedRef) {
    return responses.INVALID_SELECTION;
  }

  // Valid selection, consume the state safely (Atomic)
  try {
    const dossier = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.whatsAppConversation.updateMany({
        where: { id: conversation.id, botState: 'TRACK_SELECT' },
        data: { botState: 'IDLE', trackingContext: Prisma.DbNull }
      });

      if (updateResult.count === 0) {
        throw new Error('CONCURRENT_UPDATE');
      }

      // Re-query the dossier with Anti-IDOR
      return await tx.dossier.findFirst({
        where: {
          numeroDossier: selectedRef as string,
          phone: normalizeWhatsAppIdentity(conversation.waId)
        }
      });
    });

    if (!dossier) {
      return responses.NOT_FOUND;
    }

    const statusText = getTrackingStatusName(dossier.statut, lang);
    return responses.SINGLE_STATUS(dossier.numeroDossier, statusText, dossier.typeVehicule);

  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONCURRENT_UPDATE') {
      return null; // Silent return for concurrent, auto-reply webhook will handle or skip
    }
    console.error("Tracking selection error:", err);
    return responses.INVALID_SELECTION; // Fallback response
  }
}
