/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma';
import { WhatsAppConversation } from '@prisma/client';

export async function internalSendWhatsAppMessage(
  conversation: WhatsAppConversation,
  text: string,
  autoReplyToId?: string
) {
  if (!text || text.trim() === '') {
    return { success: false, error: 'Le message ne peut pas être vide.' };
  }

  // Vérification de la fenêtre de 24h
  if (!conversation.lastInboundAt) {
    return { success: false, error: 'Impossible d\'envoyer un message sans réponse préalable du client (règle des 24h Meta).' };
  }
  const hoursSinceLastInbound = (Date.now() - conversation.lastInboundAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastInbound > 24) {
    return { success: false, error: 'La fenêtre de 24h est expirée.' };
  }

  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquants.');
    return { success: false, error: 'Configuration WhatsApp manquante.' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: conversation.waId,
    type: 'text',
    text: {
      preview_url: false,
      body: text.trim()
    }
  };

  const timestamp = new Date();
  let reservedMessageId: string | null = null;

  // 1. Réservation en DB AVANT l'appel Meta (garantit l'idempotence stricte)
  try {
    const reservedMsg = await prisma.whatsAppMessage.create({
      data: {
        direction: 'OUTBOUND',
        content: text.trim(),
        status: 'SENT', // Statut initial optimiste/intermédiaire
        metaTimestamp: timestamp,
        conversationId: conversation.id,
        autoReplyToId
      }
    });
    reservedMessageId = reservedMsg.id;
  } catch (err: any) {
    if (err.code === 'P2002' && autoReplyToId) {
      // Déjà répondu à ce message entrant
      return { success: false, error: 'Auto-réponse déjà traitée.' };
    }
    console.error('internalSendWhatsAppMessage DB reservation error:', err);
    return { success: false, error: 'Erreur interne de persistance.' };
  }

  // 2. Appel HTTP Meta
  const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Meta API Error:', JSON.stringify(data));

    // Mettre à jour la réservation en statut FAILED
    await prisma.whatsAppMessage.update({
      where: { id: reservedMessageId },
      data: { status: 'FAILED' }
    });

    return { success: false, error: 'Erreur lors de l\'envoi via Meta API.' };
  }

  const waMessageId = data.messages && data.messages[0] ? data.messages[0].id : null;

  // 3. Mise à jour de la réservation avec succès
  try {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppMessage.update({
        where: { id: reservedMessageId! },
        data: { waMessageId }
      });

      await tx.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: timestamp }
      });
    });
    return { success: true };
  } catch (err: unknown) {
    console.error('internalSendWhatsAppMessage DB update error:', err);
    return { success: false, error: 'Erreur interne de persistance après envoi.' };
  }
}
