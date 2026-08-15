'use server';

import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function getWhatsAppConversations() {
  await requireAdmin();
  try {
    const conversations = await prisma.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });
    return { success: true, conversations };
  } catch (error: any) {
    console.error('getWhatsAppConversations error:', error);
    return { success: false, error: 'Impossible de charger les conversations.' };
  }
}

export async function getWhatsAppMessages(conversationId: string) {
  await requireAdmin();
  try {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { metaTimestamp: 'asc' },
    });
    return { success: true, messages };
  } catch (error: any) {
    console.error('getWhatsAppMessages error:', error);
    return { success: false, error: 'Impossible de charger les messages.' };
  }
}

export async function sendWhatsAppMessage(conversationId: string, text: string) {
  await requireAdmin();

  if (!text || text.trim() === '') {
    return { success: false, error: 'Le message ne peut pas être vide.' };
  }

  try {
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return { success: false, error: 'Conversation introuvable.' };
    }

    // Vérification de la fenêtre de 24h
    if (!conversation.lastInboundAt) {
      return { success: false, error: 'Impossible d\'envoyer un message libre sans réponse préalable du client (règle des 24h Meta).' };
    }
    const hoursSinceLastInbound = (Date.now() - conversation.lastInboundAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastInbound > 24) {
      return { success: false, error: 'La fenêtre de 24h est expirée. Le client doit envoyer un nouveau message pour autoriser les messages libres.' };
    }

    const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquants.');
      return { success: false, error: 'Configuration WhatsApp manquante sur le serveur.' };
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

    const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    const timestamp = new Date();

    if (!response.ok) {
      console.error('Meta API Error:', JSON.stringify(data));
      // Save FAILED status to history
      await prisma.whatsAppMessage.create({
        data: {
          direction: 'OUTBOUND',
          content: text.trim(),
          status: 'FAILED',
          metaTimestamp: timestamp,
          conversationId: conversation.id,
        }
      });
      return { success: false, error: 'Erreur lors de l\'envoi via Meta API.' };
    }

    // Success
    const waMessageId = data.messages && data.messages[0] ? data.messages[0].id : null;

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppMessage.create({
        data: {
          waMessageId,
          direction: 'OUTBOUND',
          content: text.trim(),
          status: 'SENT',
          metaTimestamp: timestamp,
          conversationId: conversation.id,
        }
      });

      await tx.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: timestamp }
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('sendWhatsAppMessage error:', error);
    return { success: false, error: 'Erreur interne lors de l\'envoi.' };
  }
}
