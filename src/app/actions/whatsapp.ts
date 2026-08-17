/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { internalSendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { Prisma } from '@prisma/client';

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
      orderBy: [
        { metaTimestamp: 'asc' },
        { createdAt: 'asc' }
      ],
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

    const result = await internalSendWhatsAppMessage(conversation, text);
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur interne lors de l\'envoi.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('sendWhatsAppMessage error:', error);
    return { success: false, error: 'Erreur interne lors de l\'envoi.' };
  }
}

export async function resumeBot(conversationId: string) {
  await requireAdmin();
  try {
    const result = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        botState: 'IDLE',
        draftQuote: Prisma.DbNull,
        trackingContext: Prisma.DbNull
      }
    });
    return { success: true, conversation: result };
  } catch (error: any) {
    console.error('resumeBot error:', error);
    return { success: false, error: 'Erreur lors de la réactivation du bot.' };
  }
}
