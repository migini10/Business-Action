import prisma from '@/lib/prisma';
import { WhatsAppConversation, WhatsAppMessage } from '@prisma/client';
import { detectLanguage, SupportedLanguage } from './language';
import { detectIntent } from './intent';
import { getFaqResponse } from './knowledge/faq';
import { handleQuoteFlow } from './quote-flow';
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

  // 3. Gestion du Workflow Conversationnel (Devis)
  // On route vers la machine à état si on n'est pas IDLE ou si c'est une demande de devis
  if (conversation.botState !== 'IDLE' || intent === 'QUOTE_REQUEST') {
    const quoteResponse = await handleQuoteFlow(conversation, text, finalLanguage || 'fr');
    if (quoteResponse) {
      await internalSendWhatsAppMessage(conversation, quoteResponse, inboundMessage.id);
      return;
    }
  }

  // 4. Génération de la réponse depuis la FAQ (Fallback)
  const responseText = getFaqResponse(finalLanguage, intent) || getFaqResponse(finalLanguage, 'UNKNOWN');

  if (!responseText) {
    // Should never happen thanks to fallback in getFaqResponse
    return;
  }

  // 5. Envoi via l'API Meta (avec réservation d'idempotence via autoReplyToId)
  await internalSendWhatsAppMessage(conversation, responseText, inboundMessage.id);
}
