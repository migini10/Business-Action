import prisma from '@/lib/prisma';
import { WhatsAppConversation, TypeVehicule, Prisma } from '@prisma/client';
import { QUOTE_RESPONSES, getVehicleTypeName } from './quote-responses';
import { sendPushNotificationSafe } from '../push/send-push';
import { handleHumanHandoff } from './human-handoff';
import { parseVehicleSelection, parseConfirmSelection } from './quote-state';

import { normalizeWhatsAppIdentity } from './identity';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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
    const response = await handleHumanHandoff(conversation, lang);
    return response;
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

      if (confirmAction === 'HUMAN_SUPPORT') {
        const response = await handleHumanHandoff(conversation, lang);
        return response;
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
        const result = await prisma.$transaction(async (tx) => {
          // Atomic consumption of the state
          const updateResult = await tx.whatsAppConversation.updateMany({
            where: { id: conversation.id, botState: 'QUOTE_CONFIRM' },
            data: { botState: 'IDLE', draftQuote: Prisma.DbNull }
          });

          if (updateResult.count === 0) {
            throw new Error('CONCURRENT_UPDATE');
          }

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

          // Notification push non bloquante
          await sendPushNotificationSafe({
            title: 'Nouvelle demande de devis',
            body: `${numeroDossier} — ${draft.typeVehicule || 'Véhicule'}`,
            url: '/admin',
          });

          return { dossier: createdDossier, credentials };
        });

        return responses.SUCCESS(result.dossier.numeroDossier, result.credentials || undefined);
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
