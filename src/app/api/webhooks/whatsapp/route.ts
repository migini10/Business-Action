import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
      // Even if malformed, WhatsApp expects a 200 to not retry indefinitely, but returning 400 is also safe if it's our fault.
      // The user requested: "JSON malformé avec signature valide => réponse contrôlée, aucun crash"
      return new NextResponse('Bad Request: Invalid JSON', { status: 400 });
    }

    // Ensure it's a WhatsApp webhook (Meta sends object="whatsapp_business_account")
    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not a WhatsApp event', { status: 404 });
    }

    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.value && change.value.statuses && Array.isArray(change.value.statuses)) {
              for (const statusObj of change.value.statuses) {
                const safeId = statusObj.id ? statusObj.id.substring(0, 15) + '...' : 'UNKNOWN_ID';
                const logData: any = {
                  event: 'WHATSAPP_MESSAGE_STATUS',
                  status: statusObj.status,
                  messageIdMasked: safeId,
                };
                if (statusObj.errors && Array.isArray(statusObj.errors) && statusObj.errors.length > 0) {
                  logData.errorCode = statusObj.errors[0].code;
                  logData.errorTitle = statusObj.errors[0].title;
                  logData.errorMessage = statusObj.errors[0].message;
                }
                console.log(JSON.stringify(logData));
              }
            }
          }
        }
      }
    }

    // Acknowledge receipt early
    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
