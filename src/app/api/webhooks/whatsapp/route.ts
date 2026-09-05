/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { processAutoReply } from '@/lib/customer-service/auto-reply';
import { sendPushNotificationSafe } from '@/lib/push/send-push';
import { processMediaStagingJobs } from '@/lib/worker/media';
import { internalSendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { recoverBotState } from '@/lib/customer-service/state-recovery';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature || !signature.startsWith('sha256=')) {
      return new NextResponse('Unauthorized: Missing or invalid signature', { status: 401 });
    }

    const rawBody = await req.text();
    const secret = process.env.WHATSAPP_APP_SECRET;

    if (!secret) {
      console.error('WHATSAPP_APP_SECRET is not configured');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const receivedSignature = signature.split('sha256=')[1];

    if (expectedSignature.length !== receivedSignature.length) {
      return new NextResponse('Unauthorized: Invalid signature length', { status: 401 });
    }

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))) {
      return new NextResponse('Unauthorized: Invalid signature', { status: 401 });
    }

    // Now safe to parse the JSON
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('Error parsing WhatsApp webhook body:', e);
      return new NextResponse('Bad Request: Invalid JSON', { status: 400 });
    }

    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not a WhatsApp event', { status: 404 });
    }

    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {

            // 1. Gérer les messages entrants (INBOUND)

            if (change.value && change.value.messages && Array.isArray(change.value.messages)) {
              for (const message of change.value.messages) {
                // ... text handling ...
                if (message.type === 'image' || message.type === 'document') {
                  const waId = message.from;
                  const waMessageId = message.id;
                  const mediaId = message.type === 'image' ? message.image.id : message.document.id;
                  const mimeType = message.type === 'image' ? message.image.mime_type : message.document.mime_type;
                  const timestamp = new Date(parseInt(message.timestamp) * 1000);

                  try {
                    await prisma.$transaction(async (tx) => {
                      const conversation = await tx.whatsAppConversation.findUnique({ where: { waId } });
                      
                      // For now, default to RECTO. In Phase B, this will map to botState.
                      
                      let expectedSlot: 'CARTE_GRISE_RECTO' | 'CARTE_GRISE_VERSO' | 'CMC' | null = null;
                      let currentBotState = conversation?.botState;
                      
                      if (conversation && conversation.botState === 'IDLE' && conversation.activeDossierId) {
                        const recovered = await recoverBotState(conversation);
                        currentBotState = recovered.botState as any;
                      }

                      if (currentBotState === 'WAITING_FOR_RECTO') {
                        expectedSlot = 'CARTE_GRISE_RECTO';
                      } else if (currentBotState === 'WAITING_FOR_VERSO') {
                        expectedSlot = 'CARTE_GRISE_VERSO';
                      } else if (currentBotState === 'WAITING_FOR_CMC') {
                        expectedSlot = 'CMC';
                      }

                      if (!expectedSlot) {
                        if (conversation) {
                          if (currentBotState === 'DOCUMENT_CHOICE') {
                            await internalSendWhatsAppMessage(
                              conversation,
                              "Veuillez d'abord choisir le type de document :\nTapez 1 pour Carte Grise, ou 2 pour CMC.",
                              waMessageId
                            );
                          } else {
                            await internalSendWhatsAppMessage(
                              conversation,
                              "Désolé, je n'attends pas de document pour le moment.",
                              waMessageId
                            );
                          }
                        }
                        return; // Skip transaction
                      }
                      
                      const expiresAt = new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000);

                      if (conversation) {
                        await tx.whatsAppMessage.upsert({
                          where: { waMessageId },
                          create: {
                            waMessageId,
                            direction: 'INBOUND',
                            content: `[Media: ${message.type}]`,
                            status: 'DELIVERED',
                            metaTimestamp: timestamp,
                            conversationId: conversation.id,
                            metadata: { isMedia: true, mediaId }
                          },
                          update: {} // Idempotent: don't modify if it exists
                        });
                      }
                      
                      await tx.mediaStaging.upsert({
                        where: { waMessageId },
                        create: {
                          source: 'WHATSAPP',
                          waMessageId,
                          mediaId,
                          waConversationId: conversation?.id,
                          dossierId: conversation?.activeDossierId,
                          expectedSlot,
                          mimeType,
                          receivedAt: timestamp,
                          expiresAt,
                          status: 'RESERVED',
                        },
                        update: {} // Idempotent: don't modify if it exists
                      });
                    });

                    after(async () => {
                      await processMediaStagingJobs();
                    });

                  } catch (err: any) {
                    console.error("Error processing Media webhook:", err);
                  }
                }
                if (message.type === 'text' && message.text) {
                  const waId = message.from;
                  const waMessageId = message.id;
                  const timestamp = new Date(parseInt(message.timestamp) * 1000);
                  const content = message.text.body;

                  let displayName = null;
                  if (change.value.contacts && Array.isArray(change.value.contacts)) {
                    const contact = change.value.contacts.find((c: any) => c.wa_id === waId);
                    if (contact && contact.profile && contact.profile.name) {
                      displayName = contact.profile.name;
                    }
                  }

                  try {
                    const result = await prisma.$transaction(async (tx) => {
                      const conversation = await tx.whatsAppConversation.upsert({
                        where: { waId },
                        update: {
                          lastMessageAt: timestamp,
                          lastInboundAt: timestamp,
                          ...(displayName ? { displayName } : {})
                        },
                        create: {
                          waId,
                          displayName,
                          lastMessageAt: timestamp,
                          lastInboundAt: timestamp,
                        }
                      });

                      const inboundMessage = await tx.whatsAppMessage.create({
                        data: {
                          waMessageId,
                          direction: 'INBOUND',
                          content,
                          status: 'RECEIVED',
                          metaTimestamp: timestamp,
                          conversationId: conversation.id,
                        }
                      });

                      return { conversation, inboundMessage };
                    });

                    const { conversation, inboundMessage } = result;

                    const truncatedMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
                    const contactName = conversation.displayName || conversation.waId;

                    // Envoi de la notification push (non-bloquant) avant processAutoReply
                    const pushResult = await sendPushNotificationSafe({
                      title: 'Nouveau message WhatsApp',
                      body: `${contactName} : ${truncatedMessage}`,
                      url: '/admin',
                    });

                    console.log(JSON.stringify({
                      event: 'WHATSAPP_ADMIN_PUSH',
                      success: pushResult,
                      messageIdMasked: waMessageId ? waMessageId.slice(0, 12) + '...' : null
                    }));

                    try {
                      await processAutoReply(conversation, inboundMessage, content);
                    } catch (autoErr) {
                      console.error("Auto-reply processing failed:", autoErr);
                    }

                  } catch (err: unknown) {
                    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                      // Doublon de webhook pour un même waMessageId => ignorer silencieusement
                    } else {
                      console.error("Error inserting inbound WhatsApp message:", err);
                      throw err;
                    }
                  }
                }
              }
            }

            // 2. Gérer les statuts sortants (OUTBOUND)
            if (change.value && change.value.statuses && Array.isArray(change.value.statuses)) {
              for (const statusObj of change.value.statuses) {
                const waMessageId = statusObj.id;
                const status = statusObj.status ? statusObj.status.toUpperCase() : 'UNKNOWN';
                const timestamp = new Date(parseInt(statusObj.timestamp) * 1000);

                const safeId = waMessageId ? waMessageId.substring(0, 15) + '...' : 'UNKNOWN_ID';
                const logData: any = {
                  event: 'WHATSAPP_MESSAGE_STATUS',
                  status: status,
                  messageIdMasked: safeId,
                };

                if (statusObj.errors && Array.isArray(statusObj.errors) && statusObj.errors.length > 0) {
                  logData.errorCode = statusObj.errors[0].code;
                  logData.errorTitle = statusObj.errors[0].title;
                  logData.errorMessage = statusObj.errors[0].message;
                }
                console.log(JSON.stringify(logData));

                if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) {
                  try {
                    const existingMsg = await prisma.whatsAppMessage.findUnique({ where: { waMessageId } });
                    if (existingMsg) {
                      // Appliquer la logique de statut
                      const isNewer = timestamp >= existingMsg.metaTimestamp;
                      if (isNewer || status === 'FAILED') {
                        await prisma.whatsAppMessage.update({
                          where: { waMessageId },
                          data: {
                            status: status as any,
                            metaTimestamp: isNewer ? timestamp : existingMsg.metaTimestamp,
                          }
                        });
                      }
                    }
                  } catch (err) {
                    console.error("Error updating WhatsApp status:", err);
                  }
                }
              }
            }
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
