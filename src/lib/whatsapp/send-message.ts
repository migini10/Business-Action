/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma';
import { WhatsAppConversation, Prisma } from '@prisma/client';

export async function internalSendWhatsAppMessage(
  conversation: WhatsAppConversation,
  text: string,
  autoReplyToId?: string,
  transitionMetadata?: { nextBotState?: string; clearDraft?: boolean; [key: string]: any },
  deps = { db: prisma as any }
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
    const reservedMsg = await deps.db.whatsAppMessage.create({
      data: {
        direction: 'OUTBOUND',
        content: text.trim(),
        status: 'PENDING', // Attente de la confirmation réseau
        metaTimestamp: timestamp,
        conversationId: conversation.id,
        autoReplyToId,
        metadata: (transitionMetadata ? { ...transitionMetadata, expectedBotState: conversation.botState } : { expectedBotState: conversation.botState }) as any
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
  let response;
  try {
    response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchErr) {
    console.error('Meta API Network Error:', fetchErr);
    try {
      await deps.db.whatsAppMessage.update({
        where: { id: reservedMessageId! },
        data: { status: 'FAILED' }
      });
    } catch (dbErr) {
      console.error('Failed to update status on fetch error:', dbErr);
    }
    return { success: false, error: 'Erreur réseau lors de l\'envoi via Meta API.' };
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.error('Meta API Parse Error:', parseErr);
    data = { error: 'Failed to parse JSON response' };
  }

  if (!response.ok) {
    console.error('Meta API Error:', JSON.stringify(data));

    // Mettre à jour la réservation en statut FAILED
    try {
      await deps.db.whatsAppMessage.update({
        where: { id: reservedMessageId },
        data: { status: 'FAILED' }
      });
    } catch (dbErr) {
      console.error('Failed to update status on Meta API error:', dbErr);
    }

    return { success: false, error: 'Erreur lors de l\'envoi via Meta API.' };
  }

  
  const waMessageId = data.messages && data.messages[0] ? data.messages[0].id : null;

  // Succès: on update le message et potentiellement on avance le botState
  try {
    if (transitionMetadata) {
      const updateData: any = {};
      if (transitionMetadata.nextBotState) updateData.botState = transitionMetadata.nextBotState;
      if (transitionMetadata.clearDraft) updateData.draftQuote = Prisma.DbNull;

      await deps.db.$transaction([
        deps.db.whatsAppMessage.update({
          where: { id: reservedMessageId },
          data: { status: 'SENT', waMessageId, metadata: transitionMetadata as any }
        }),
        deps.db.whatsAppConversation.update({
          where: { id: conversation.id },
          data: updateData
        })
      ]);
    } else {
      await deps.db.whatsAppMessage.update({
        where: { id: reservedMessageId },
        data: { status: 'SENT', waMessageId }
      });
    }
  } catch (dbErr) {
    console.error('Failed to update status on success:', dbErr);
  }

  return { success: true, messageId: reservedMessageId, waMessageId };

}

export async function retryOutboundWhatsAppMessage(messageId: string, deps = { db: prisma as any }) {
  // 1. Claim atomic
  const claim = await deps.db.whatsAppMessage.updateMany({
    where: {
      id: messageId,
      status: { in: ['FAILED', 'RETRYING', 'PENDING'] },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: new Date() } }
      ]
    },
    data: {
      status: 'RETRYING',
      nextAttemptAt: new Date(Date.now() + 60000) // Lock for 1 minute
    }
  });

  if (claim.count === 0) {
    return { success: false, error: 'Message non éligible au retry ou déjà en cours.' };
  }

  const msg = await deps.db.whatsAppMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true }
  });

  if (!msg || !msg.conversation) return { success: false, error: 'Not found' };

  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { success: false, error: 'Config missing' };
  }

  const meta = msg.metadata as any;
  if (meta && meta.expectedBotState && meta.expectedBotState !== msg.conversation.botState) {
    // Obsolete context, do not retry
    await deps.db.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        nextAttemptAt: null,
        lastErrorCode: 'OBSOLETE_CONTEXT'
      }
    });
    return { success: false, error: 'Obsolete context' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.conversation.waId,
    type: 'text',
    text: { preview_url: false, body: msg.content.trim() }
  };

  let response;
  try {
    response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    } catch (fetchErr: any) {
      console.error(JSON.stringify({
        event: 'META_API_NETWORK_ERROR_RETRY',
        errorName: fetchErr.name || 'Error',
        errorMessage: fetchErr.message || 'Unknown network error'
      }));
      const nextRetryCount = msg.retryCount + 1;
      const isFinal = nextRetryCount >= 3;
      await deps.db.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: isFinal ? 'FAILED' : 'RETRYING',
          retryCount: nextRetryCount,
          nextAttemptAt: isFinal ? null : new Date(Date.now() + nextRetryCount * 60000),
          lastErrorCode: fetchErr.message || 'Fetch failed'
        }
      });
      return { success: false, error: 'Fetch failed' };
    }

  let data: any = {};
  try { data = await response.json(); } catch(e){}

  if (!response.ok) {
    console.error(JSON.stringify({
      event: 'META_API_ERROR_RETRY',
      metaHttpStatus: response.status,
      errorCode: data?.error?.code,
      errorSubcode: data?.error?.error_subcode,
      errorType: data?.error?.type,
      errorMessage: data?.error?.message,
      fbtraceId: data?.error?.fbtrace_id ? 'PRESENT' : 'ABSENT'
    }));

    const nextRetryCount = msg.retryCount + 1;
    const isFinal = nextRetryCount >= 3;
    await deps.db.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: isFinal ? 'FAILED' : 'RETRYING',
        retryCount: nextRetryCount,
        nextAttemptAt: isFinal ? null : new Date(Date.now() + nextRetryCount * 60000),
        lastErrorCode: data.error?.message || 'API Error'
      }
    });
    return { success: false, error: 'API Error' };
  }

  const waMessageId = data.messages && data.messages[0] ? data.messages[0].id : null;

  if (meta && meta.nextBotState && msg.conversation.botState === meta.expectedBotState) {
    const updateData: any = { botState: meta.nextBotState };
    if (meta.clearDraft) updateData.draftQuote = Prisma.DbNull;
    
    await deps.db.$transaction([
      deps.db.whatsAppMessage.update({
        where: { id: messageId },
        data: { status: 'SENT', waMessageId, nextAttemptAt: null }
      }),
      deps.db.whatsAppConversation.update({
        where: { id: msg.conversation.id },
        data: updateData
      })
    ]);
  } else {
    await deps.db.whatsAppMessage.update({
      where: { id: messageId },
      data: { status: 'SENT', waMessageId, nextAttemptAt: null }
    });
  }

  return { success: true, messageId, waMessageId };
}
