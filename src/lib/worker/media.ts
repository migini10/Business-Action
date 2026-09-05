import prisma from '@/lib/prisma';
import { getSupabase, getDossierDocumentsBucket } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { QUOTE_RESPONSES } from '@/lib/customer-service/quote-responses';
import { internalSendWhatsAppMessage, retryOutboundWhatsAppMessage } from '@/lib/whatsapp/send-message';

export async function processMediaStagingJobs() {
  // 1. Atomically lock up to 5 jobs
  const jobs = await prisma.$queryRaw<any[]>`
    UPDATE "MediaStaging" 
    SET "leaseUntil" = NOW() + INTERVAL '5 minutes'
    WHERE id IN (
      SELECT id FROM "MediaStaging" 
      WHERE status IN ('RESERVED', 'RETRYING') 
        AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    ) RETURNING *;
  `;

  let processedMedia = 0;
  if (jobs && jobs.length > 0) {
    processedMedia = jobs.length;
    const supabase = getSupabase();
    const bucket = getDossierDocumentsBucket();

    for (const job of jobs) {
      try {
        if (job.source !== 'WHATSAPP' || !job.mediaId) continue;

        // Fetch from Meta API
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const metaRes = await fetch(`https://graph.facebook.com/v17.0/${job.mediaId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!metaRes.ok) throw new Error(`Meta API error: ${metaRes.statusText}`);
        const metaData = await metaRes.json();
        const downloadUrl = metaData.url;
        const mimeType = metaData.mime_type;
        const sizeBytes = metaData.file_size;

        // Validation
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (sizeBytes > MAX_SIZE) {
          await failJob(job.id, 'File too large');
          continue;
        }

        const validMimes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validMimes.includes(mimeType)) {
          await failJob(job.id, 'Invalid file type');
          continue;
        }

        // Download Binary
        const mediaRes = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!mediaRes.ok) throw new Error('Failed to download media binary');
        
        const arrayBuffer = await mediaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload Supabase
        const opaqueId = randomUUID();
        const ext = mimeType.split('/').pop() || 'bin';
        const storagePath = `staging/${opaqueId}/file.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, buffer, { contentType: mimeType });

        if (uploadError) throw new Error(`Supabase error: ${uploadError.message}`);

        // 1. Create DossierDocument if possible
        if (job.dossierId && job.expectedSlot) {
          const docType = job.expectedSlot === 'CMC' ? 'CMC' : 'CARTE_GRISE';
          const docSide = job.expectedSlot === 'CARTE_GRISE_RECTO' ? 'RECTO' : 
                          job.expectedSlot === 'CARTE_GRISE_VERSO' ? 'VERSO' : 'SINGLE';
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          await prisma.dossierDocument.create({
            data: {
              dossierId: job.dossierId,
              type: docType,
              side: docSide,
              storagePath,
              mimeType,
              expiresAt
            }
          });
        }

        // 2. Update Job Success & MOVED
        await prisma.mediaStaging.update({
          where: { id: job.id },
          data: {
            status: 'MOVED',
            storagePath,
            mimeType,
            sizeBytes,
            processedAt: new Date(),
            leaseUntil: null
          }
        });

        // Chat flow progression (Idempotent)
        if (job.waConversationId) {
          const conv = await prisma.whatsAppConversation.findUnique({
            where: { id: job.waConversationId }
          });
          if (conv) {
            const lang = (conv.language as 'fr' | 'en' | 'wo') || 'fr';
            if (job.expectedSlot === 'CARTE_GRISE_RECTO') {
              if (conv.botState === 'WAITING_FOR_RECTO') {
                console.log('CALLING internalSendWhatsAppMessage FOR RECTO', conv.id);
                const res = await internalSendWhatsAppMessage(conv, QUOTE_RESPONSES[lang].WAITING_VERSO_PROMPT, job.waMessageId || undefined, { nextBotState: 'WAITING_FOR_VERSO' });
                if (!res.success && res.error !== 'Auto-réponse déjà traitée.') {
                  console.error('Failed to dispatch CARTE_GRISE_RECTO auto-reply:', res.error);
                }
              } else {
                console.log('STATE MISMATCH', conv.botState);
              }
            } else if (job.expectedSlot === 'CARTE_GRISE_VERSO') {
              if (conv.botState === 'WAITING_FOR_VERSO') {
                const res = await internalSendWhatsAppMessage(conv, QUOTE_RESPONSES[lang].DOCUMENTS_RECEIVED, job.waMessageId || undefined, { nextBotState: 'IDLE' });
                if (!res.success && res.error !== 'Auto-réponse déjà traitée.') {
                  console.error('Failed to dispatch CARTE_GRISE_VERSO auto-reply:', res.error);
                }
              }
            } else if (job.expectedSlot === 'CMC') {
              if (conv.botState === 'WAITING_FOR_CMC') {
                const res = await internalSendWhatsAppMessage(conv, QUOTE_RESPONSES[lang].DOCUMENTS_RECEIVED, job.waMessageId || undefined, { nextBotState: 'IDLE' });
                if (!res.success && res.error !== 'Auto-réponse déjà traitée.') {
                  console.error('Failed to dispatch CMC auto-reply:', res.error);
                }
              }
            }
          }
        }

      } catch (err: any) {
        console.error(`Job ${job.id} failed:`, err); console.error(err.stack);
        const retryCount = job.retryCount + 1;
        if (retryCount >= 3) {
          await failJob(job.id, err.message);
        } else {
          await prisma.mediaStaging.update({
            where: { id: job.id },
            data: {
              status: 'RETRYING',
              retryCount,
              nextAttemptAt: new Date(Date.now() + retryCount * 60000), // exp backoff
              leaseUntil: null,
              lastErrorCode: err.message.substring(0, 200)
            }
          });
        }
      }
    }
  }

  // 2. Retry failed WhatsApp messages
  let processedWaMsgs = 0;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
  const waMsgs = await prisma.whatsAppMessage.findMany({
    where: {
      OR: [
        {
          status: { in: ['FAILED', 'RETRYING'] },
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: new Date() } }
          ]
        },
        {
          status: 'PENDING',
          createdAt: { lte: fiveMinutesAgo }
        }
      ]
    },
    take: 5
  });

  if (waMsgs.length > 0) {
    processedWaMsgs = waMsgs.length;
    for (const msg of waMsgs) {
      await retryOutboundWhatsAppMessage(msg.id);
    }
  }

  return { processedMedia, processedWaMsgs };
}

async function failJob(id: string, reason: string) {
  await prisma.mediaStaging.update({
    where: { id },
    data: {
      status: 'FAILED',
      leaseUntil: null,
      lastErrorCode: reason.substring(0, 200)
    }
  });
}
