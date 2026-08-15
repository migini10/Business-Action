import prisma from '@/lib/prisma';
import { WhatsAppConversation, WhatsAppMessage } from '@prisma/client';
import { detectLanguage, SupportedLanguage } from './language';
import { detectIntent } from './intent';
import { getAutoResponse } from './responses';
import { internalSendWhatsAppMessage } from '@/lib/whatsapp/send-message';

export async function processAutoReply(
  conversation: WhatsAppConversation,
  inboundMessage: WhatsAppMessage,
  text: string
) {
  // 1. Détection de la langue
  const detectedLanguage = detectLanguage(text);
  let finalLanguage = conversation.language as SupportedLanguage | null;

  if (detectedLanguage) {
    finalLanguage = detectedLanguage;
    // Mettre à jour la langue de la conversation si elle change
    if (conversation.language !== detectedLanguage) {
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { language: detectedLanguage }
      });
      conversation.language = detectedLanguage;
    }
  }

  // 2. Détection de l'intention
  const intent = detectIntent(text);

  // 3. Génération de la réponse
  const responseText = getAutoResponse(finalLanguage, intent);

  // 4. Envoi via l'API Meta (avec réservation d'idempotence via autoReplyToId)
  await internalSendWhatsAppMessage(conversation, responseText, inboundMessage.id);
}
