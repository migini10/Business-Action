import prisma from '@/lib/prisma';
import { WhatsAppConversation, TypeVehicule, Prisma } from '@prisma/client';
import { QUOTE_RESPONSES, getVehicleTypeName } from './quote-responses';
import { parseVehicleSelection, parseConfirmSelection } from './quote-state';

function extractPhone(waId: string): string {
  // Remove trailing details, just get the number, assume waId is already the phone
  // In reality waId looks like "221771234567"
  return "+" + waId;
}

export async function handleQuoteFlow(
  conversation: WhatsAppConversation,
  text: string,
  lang: 'fr' | 'en' | 'wo'
): Promise<string | null> {
  const normalizedText = text.toLowerCase().trim();
  const responses = QUOTE_RESPONSES[lang];
  
  // Interruption logic (human transfer, cancel, restart)
  const isHuman = ['humain', 'agent', 'conseiller', 'human', 'nit'].some(k => normalizedText.includes(k));
  if (isHuman) {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE', draftQuote: Prisma.DbNull }
    });
    return responses.HUMAN_TRANSFER;
  }

  const isCancel = ['annuler', 'cancel', 'bayyi', 'bàyyi'].includes(normalizedText);
  if (isCancel && conversation.botState !== 'IDLE') {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE', draftQuote: Prisma.DbNull }
    });
    return responses.CANCELLED;
  }

  const isRestart = ['recommencer', 'restart', 'tambaliwaat'].includes(normalizedText);
  if (isRestart) {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'QUOTE_VEHICLE', draftQuote: Prisma.DbNull }
    });
    return responses.SERVICE_PROMPT;
  }

  // State Machine
  switch (conversation.botState) {
    case 'IDLE':
      // This is triggered by auto-reply intent detection
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { botState: 'QUOTE_VEHICLE', draftQuote: Prisma.DbNull }
      });
      return responses.SERVICE_PROMPT;

    case 'QUOTE_VEHICLE':
      const vehicleType = parseVehicleSelection(text);
      if (!vehicleType) {
        return responses.SERVICE_INVALID;
      }
      
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { 
          botState: 'QUOTE_CONFIRM', 
          draftQuote: { typeVehicule: vehicleType } 
        }
      });
      
      const vehicleName = getVehicleTypeName(vehicleType, lang);
      return responses.CONFIRM_PROMPT(vehicleName);

    case 'QUOTE_CONFIRM':
      const confirmAction = parseConfirmSelection(text);
      if (!confirmAction) {
        return responses.CONFIRM_INVALID;
      }

      if (confirmAction === 'CANCEL') {
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: { botState: 'IDLE', draftQuote: Prisma.DbNull }
        });
        return responses.CANCELLED;
      }

      if (confirmAction === 'MODIFY') {
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: { botState: 'QUOTE_VEHICLE', draftQuote: Prisma.DbNull }
        });
        return responses.SERVICE_PROMPT;
      }

      // Action === 'CONFIRM'
      const draft = conversation.draftQuote as { typeVehicule?: TypeVehicule } | null;
      if (!draft || !draft.typeVehicule) {
        // Fallback safety
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: { botState: 'QUOTE_VEHICLE', draftQuote: Prisma.DbNull }
        });
        return responses.SERVICE_PROMPT;
      }

      try {
        const dossier = await prisma.$transaction(async (tx) => {
          // Atomic consumption of the state
          const updateResult = await tx.whatsAppConversation.updateMany({
            where: { id: conversation.id, botState: 'QUOTE_CONFIRM' },
            data: { botState: 'IDLE', draftQuote: Prisma.DbNull }
          });

          if (updateResult.count === 0) {
            throw new Error('CONCURRENT_UPDATE');
          }

          const numeroDossier = 'DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN';
          const phoneStr = extractPhone(conversation.waId);

          // Find user to associate if exists
          const user = await tx.user.findUnique({
            where: { phone: phoneStr }
          });

          return await tx.dossier.create({
            data: {
              numeroDossier,
              phone: phoneStr,
              typeVehicule: draft.typeVehicule as TypeVehicule,
              clientId: user ? user.id : null
            }
          });
        });

        return responses.SUCCESS(dossier.numeroDossier);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'CONCURRENT_UPDATE') {
          return responses.CONCURRENT_ERROR;
        }
        console.error("Quote creation error:", err);
        return responses.ERROR;
      }

    default:
      return null;
  }
}
