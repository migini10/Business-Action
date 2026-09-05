import prisma from '@/lib/prisma';
import { WhatsAppConversation, TypeVehicule, Prisma } from '@prisma/client';
import { QUOTE_RESPONSES, getVehicleTypeName } from './quote-responses';
import { sendPushNotificationSafe } from '../push/send-push';
import { handleHumanHandoff } from './human-handoff';
import { parseVehicleSelection, parseConfirmSelection } from './quote-state';

import { normalizeWhatsAppIdentity } from './identity';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export type FlowResponse = {
  text: string;
  nextBotState?: string;
  clearDraft?: boolean;
};

export async function handleQuoteFlow(
  conversation: WhatsAppConversation,
  text: string,
  lang: 'fr' | 'en' | 'wo'
): Promise<FlowResponse | string | null> {
  const normalizedText = text.toLowerCase().trim();
  const responses = QUOTE_RESPONSES[lang];

  // Interruption logic (human transfer, cancel, restart)
  const isHuman = ['humain', 'agent', 'conseiller', 'human', 'nit'].some(k => normalizedText.includes(k));
  if (isHuman) {
    const response = await handleHumanHandoff(conversation, lang);
    return response;
  }

  const isCancel = ['annuler', 'cancel', 'bayyi', 'bàyyi'].includes(normalizedText);
  if (isCancel && conversation.botState !== 'IDLE') {
    return { text: responses.CANCELLED, nextBotState: 'IDLE', clearDraft: true };
  }

  const isRestart = ['recommencer', 'restart', 'tambaliwaat'].includes(normalizedText);
  if (isRestart) {
    return { text: responses.SERVICE_PROMPT, nextBotState: 'QUOTE_VEHICLE', clearDraft: true };
  }

  // State Machine
  switch (conversation.botState) {
    case 'MAIN_MENU':
    case 'IDLE':
      // This is triggered by auto-reply intent detection
      return { text: responses.SERVICE_PROMPT, nextBotState: 'QUOTE_VEHICLE', clearDraft: true };

    case 'QUOTE_VEHICLE':
      const vehicleType = parseVehicleSelection(text);
      if (!vehicleType) {
        return responses.SERVICE_INVALID;
      }

      if (vehicleType === 'HUMAN_SUPPORT') {
        const response = await handleHumanHandoff(conversation, lang);
        return response;
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
        return { text: responses.CANCELLED, nextBotState: 'IDLE', clearDraft: true };
      }

      if (confirmAction === 'MODIFY') {
        return { text: responses.SERVICE_PROMPT, nextBotState: 'QUOTE_VEHICLE', clearDraft: true };
      }

      if (confirmAction === 'HUMAN_SUPPORT') {
        const response = await handleHumanHandoff(conversation, lang);
        return response;
      }

      // Action === 'CONFIRM'
      const draft = conversation.draftQuote as { typeVehicule?: TypeVehicule } | null;
      if (!draft || !draft.typeVehicule) {
        // Fallback safety
        return { text: responses.SERVICE_PROMPT, nextBotState: 'QUOTE_VEHICLE', clearDraft: true };
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Atomic consumption of the state
          // updateResult moved below

          const numeroDossier = 'DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN';
          const phoneStr = normalizeWhatsAppIdentity(conversation.waId);

          // Find user to associate if exists
          let user = await tx.user.findUnique({
            where: { phone: phoneStr }
          });

          let credentials = null;

          if (!user) {
            const plainPass = crypto.randomBytes(4).toString('hex');
            const hashedPassword = await bcrypt.hash(plainPass, 10);
            try {
              user = await tx.user.create({
                data: {
                  phone: phoneStr,
                  password: hashedPassword,
                  role: 'CLIENT',
                  mustChangePassword: true,
                  temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
              });
              credentials = { phone: phoneStr, plainPass };
            } catch (err: any) {
              if (err.code === 'P2002') {
                // Créé concurremment par une autre session/processus
                user = await tx.user.findUnique({
                  where: { phone: phoneStr }
                });
                if (!user) throw err;
              } else {
                throw err;
              }
            }
          }

          const createdDossier = await tx.dossier.create({
            data: {
              numeroDossier,
              phone: phoneStr,
              typeVehicule: draft.typeVehicule as TypeVehicule,
              clientId: user.id
            }
          });

          const updateResult = await tx.whatsAppConversation.updateMany({
            where: { id: conversation.id, activeDossierId: null, botState: 'QUOTE_CONFIRM' },
            data: { activeDossierId: createdDossier.id }
          });
          if (updateResult.count === 0) throw new Error('CONCURRENT_UPDATE');

          // removed to combine with updateMany

          // Notification push non bloquante
          await sendPushNotificationSafe({
            title: 'Nouvelle demande de devis',
            body: `${numeroDossier} — ${draft.typeVehicule || 'Véhicule'}`,
            url: '/admin',
          });

          return { dossier: createdDossier, credentials };
        });

        const successMsg = responses.SUCCESS(result.dossier.numeroDossier, result.credentials || undefined);
        return { 
          text: `${successMsg}\n\n${responses.DOCUMENT_CHOICE_PROMPT}`, 
          nextBotState: 'DOCUMENT_CHOICE', 
          clearDraft: true 
        };
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'CONCURRENT_UPDATE') {
          return responses.CONCURRENT_ERROR;
        }
        console.error("Quote creation error:", err);
        return responses.ERROR;
      }

    case 'DOCUMENT_CHOICE':
      if (text === '1') {
        if (conversation.activeDossierId) {
          await prisma.dossier.update({
            where: { id: conversation.activeDossierId },
            data: { documentFlow: 'CARTE_GRISE' }
          });
        }
        return { text: responses.WAITING_RECTO_PROMPT, nextBotState: 'WAITING_FOR_RECTO' };
      } else if (text === '2') {
        if (conversation.activeDossierId) {
          await prisma.dossier.update({
            where: { id: conversation.activeDossierId },
            data: { documentFlow: 'CMC' }
          });
        }
        return { text: responses.WAITING_CMC_PROMPT, nextBotState: 'WAITING_FOR_CMC' };
      } else {
        return responses.DOCUMENT_CHOICE_INVALID;
      }

    default:
      return null;
  }
}
