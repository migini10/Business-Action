import prisma from '@/lib/prisma';
import { WhatsAppConversation, WhatsAppMessage } from '@prisma/client';
import { detectLanguage, SupportedLanguage } from './language';
import { detectIntent } from './intent';
import { getFaqResponse } from './knowledge/faq';
import { handleQuoteFlow } from './quote-flow';
import { handleTrackingStart, handleTrackingSelect } from './tracking-flow';
import { handleHumanHandoff } from './human-handoff';
import { internalSendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { recoverBotState } from './state-recovery';

export async function processAutoReply(
  conversation: WhatsAppConversation,
  inboundMessage: WhatsAppMessage,
  text: string
) {
  // 0. Si le bot est déjà en mode humain, il ne répond plus
  if (conversation.botState === 'HUMAN_SUPPORT') {
    return;
  }

  // 0.5 Garde défensive de synchronisation d'état
  if (conversation.botState === 'IDLE' && conversation.activeDossierId) {

    const recovered = await recoverBotState(conversation);
    
    if (recovered.isComplete) {
      // Si la collecte est terminée, on permet un nouveau devis propre
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { activeDossierId: null }
      });
      conversation.activeDossierId = null;
    } else {
      // Si la collecte n'est pas terminée, on restaure l'état d'attente
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { botState: recovered.botState as any }
      });
      conversation.botState = recovered.botState as any;
    }
  }

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
  let intent = detectIntent(text);

  // 2.2 Gestion du menu principal (MAIN_MENU)
  if (conversation.botState === 'MAIN_MENU') {
    const choice = text.trim();
    if (choice === '1') {
      intent = 'QUOTE_REQUEST';
    } else if (choice === '2') {
      intent = 'REQUEST_STATUS';
    } else if (choice === '3') {
      intent = 'HUMAN_SUPPORT';
    } else {
      // Si l'utilisateur n'a pas tapé 1/2/3, on accepte l'intention naturelle si elle correspond,
      // sinon c'est un choix invalide.
      if (!['QUOTE_REQUEST', 'REQUEST_STATUS', 'HUMAN_SUPPORT'].includes(intent)) {
        const invalidMsg = finalLanguage === 'wo' 
          ? "Tann bi baaxul. Bësal 1 (Ndëgël), 2 (Toppatoo), mbaa 3 (Waxtaan ak nit)."
          : finalLanguage === 'en'
          ? "Invalid choice. Please reply with 1 (Quote), 2 (Tracking), or 3 (Advisor)."
          : "Choix invalide. Veuillez répondre par 1 (Devis), 2 (Suivi), ou 3 (Conseiller).";
        await internalSendWhatsAppMessage(conversation, invalidMsg, inboundMessage.id);
        return;
      }
    }
    
    // Sortir du MAIN_MENU car on a un choix valide
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'IDLE' }
    });
    conversation.botState = 'IDLE';
  }

  // 2.5 Handoff explicit (Parler à un conseiller)
  if (intent === 'HUMAN_SUPPORT') {
    const handoffResponse = await handleHumanHandoff(conversation, finalLanguage || 'fr');
    if (handoffResponse) {
      await internalSendWhatsAppMessage(conversation, handoffResponse, inboundMessage.id);
    }
    return;
  }

  // 3. Gestion du Workflow Conversationnel (Devis)
  // On route vers la machine à état si on n'est pas IDLE ou si c'est une demande de devis
  if (
    conversation.botState === 'QUOTE_VEHICLE' || 
    conversation.botState === 'QUOTE_CONFIRM' || 
    conversation.botState === 'DOCUMENT_CHOICE' ||
    intent === 'QUOTE_REQUEST'
  ) {
    const quoteResponse = await handleQuoteFlow(conversation, text, finalLanguage || 'fr');
    if (quoteResponse) {
      if (typeof quoteResponse === 'string') {
        await internalSendWhatsAppMessage(conversation, quoteResponse, inboundMessage.id);
      } else {
        await internalSendWhatsAppMessage(conversation, quoteResponse.text, inboundMessage.id, {
          nextBotState: quoteResponse.nextBotState,
          clearDraft: quoteResponse.clearDraft
        });
      }
      return;
    }
  }

  // 3.5 Gestion du Suivi de Dossier
  if (conversation.botState === 'TRACK_SELECT' || intent === 'REQUEST_STATUS') {
    const trackingResponse = conversation.botState === 'TRACK_SELECT'
      ? await handleTrackingSelect(conversation, text, finalLanguage || 'fr')
      : await handleTrackingStart(conversation, text, finalLanguage || 'fr');

    if (trackingResponse) {
      await internalSendWhatsAppMessage(conversation, trackingResponse, inboundMessage.id);
      return;
    }
  }

  // 4. Génération de la réponse depuis la FAQ (Fallback)
  const responseText = getFaqResponse(finalLanguage, intent) || getFaqResponse(finalLanguage, 'UNKNOWN');

  if (!responseText) {
    // Should never happen thanks to fallback in getFaqResponse
    return;
  }

  // 4.5 Si c'est un GREETING, on passe en MAIN_MENU pour attendre le choix 1, 2, 3
  if (intent === 'GREETING') {
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { botState: 'MAIN_MENU' }
    });
    conversation.botState = 'MAIN_MENU';
  }

  // 5. Envoi via l'API Meta (avec réservation d'idempotence via autoReplyToId)
  await internalSendWhatsAppMessage(conversation, responseText, inboundMessage.id);
}
