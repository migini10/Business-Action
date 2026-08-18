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
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    const unreadCounts = await prisma.whatsAppMessage.groupBy({
      by: ['conversationId'],
      where: {
        direction: 'INBOUND',
        readAt: null
      },
      _count: {
        _all: true
      }
    });

    const unreadMap = new Map();
    for (const item of unreadCounts) {
      unreadMap.set(item.conversationId, item._count._all);
    }

    // Map to include unreadCount
    const mapped = conversations.map((c: any) => ({
      ...c,
      unreadCount: unreadMap.get(c.id) || 0,
    }));

    return { success: true, conversations: mapped };
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
        { createdAt: 'asc' },
        { id: 'asc' }
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

export async function markConversationAsRead(conversationId: string, lastSeenInboundMessageId: string) {
  await requireAdmin();
  try {
    const lastSeenMessage = await prisma.whatsAppMessage.findFirst({
      where: {
        id: lastSeenInboundMessageId,
        conversationId: conversationId,
        direction: 'INBOUND'
      }
    });

    if (!lastSeenMessage) {
      return { success: false, error: 'Message de borne introuvable.' };
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.whatsAppMessage.updateMany({
        where: {
          conversationId,
          direction: 'INBOUND',
          readAt: null,
          OR: [
            { metaTimestamp: { lt: lastSeenMessage.metaTimestamp } },
            {
              metaTimestamp: lastSeenMessage.metaTimestamp,
              createdAt: { lt: lastSeenMessage.createdAt }
            },
            {
              metaTimestamp: lastSeenMessage.metaTimestamp,
              createdAt: lastSeenMessage.createdAt,
              id: { lte: lastSeenMessage.id }
            }
          ]
        },
        data: {
          readAt: now
        }
      });
      await tx.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastReadAt: now }
      });
    });
    return { success: true };
  } catch (error: any) {
    console.error('markConversationAsRead error:', error);
    return { success: false, error: 'Erreur lors du marquage comme lu.' };
  }
}

export async function claimConversation(conversationId: string) {
  await requireAdmin();
  try {
    const result = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        supportStatus: 'IN_PROGRESS',
        claimedAt: new Date(),
        resolvedAt: null
      }
    });
    return { success: true, conversation: result };
  } catch (error: any) {
    console.error('claimConversation error:', error);
    return { success: false, error: 'Erreur lors de la prise en charge.' };
  }
}

export async function resolveConversation(conversationId: string) {
  await requireAdmin();
  try {
    const result = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        supportStatus: 'RESOLVED',
        resolvedAt: new Date()
      }
    });
    return { success: true, conversation: result };
  } catch (error: any) {
    console.error('resolveConversation error:', error);
    return { success: false, error: 'Erreur lors de la résolution.' };
  }
}

export async function reopenConversation(conversationId: string) {
  await requireAdmin();
  try {
    const result = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        supportStatus: 'TO_DO',
        claimedAt: null,
        resolvedAt: null
      }
    });
    return { success: true, conversation: result };
  } catch (error: any) {
    console.error('reopenConversation error:', error);
    return { success: false, error: 'Erreur lors de la réouverture.' };
  }
}
