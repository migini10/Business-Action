/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
                    const conversation = await prisma.whatsAppConversation.upsert({
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

                    await prisma.whatsAppMessage.create({
                      data: {
                        waMessageId,
                        direction: 'INBOUND',
                        content,
                        status: 'RECEIVED',
                        metaTimestamp: timestamp,
                        conversationId: conversation.id,
                      }
                    });
                  } catch (err: unknown) {
                    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                      // Doublon de webhook pour un même waMessageId => ignorer silencieusement
                    } else {
                      console.error("Error inserting inbound WhatsApp message:", err);
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
