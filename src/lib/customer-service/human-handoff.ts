import prisma from '@/lib/prisma';
import { WhatsAppConversation, Prisma } from '@prisma/client';
import { SupportedLanguage } from './language';
import { sendPushNotificationSafe } from '../push/send-push';

const HANDOFF_RESPONSES = {
  fr: "Votre demande a été transmise à un conseiller Business Action. Il vous répondra ici dès que possible.",
  en: "Your request has been forwarded to a Business Action advisor. They will reply here as soon as possible.",
  wo: "Jox nañu sa mbir mi ab laytekat bu Business Action. Dina la tontu fi ci lu gaaw."
};

export async function handleHumanHandoff(
  conversation: WhatsAppConversation,
  language: SupportedLanguage
): Promise<string | null> {
  const result = await prisma.whatsAppConversation.updateMany({
    where: {
      id: conversation.id,
      botState: {
        not: 'HUMAN_SUPPORT'
      }
    },
    data: {
      botState: 'HUMAN_SUPPORT',
      draftQuote: Prisma.DbNull,
      trackingContext: Prisma.DbNull
    }
  });

  if (result.count === 0) {
    // Already in HUMAN_SUPPORT
    return null;
  }

  // Send ONE push notification to Admin
  const contactName = conversation.displayName || conversation.waId;
  await sendPushNotificationSafe({
    title: 'Client en attente d’un conseiller',
    body: `${contactName} a demandé à parler à un humain.`,
    url: '/admin'
  });

  return HANDOFF_RESPONSES[language] || HANDOFF_RESPONSES['fr'];
}
