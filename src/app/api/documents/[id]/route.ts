import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { getCurrentClient } from '@/lib/client-auth'
import prisma from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { getDossierDocumentsBucket } from '@/lib/supabase'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabase) return new NextResponse("Supabase config error", { status: 500 })

  let bucket: string;
  try {
    bucket = getDossierDocumentsBucket();
  } catch {
    return new NextResponse("Storage bucket config error", { status: 500 })
  }

  const doc = await prisma.dossierDocument.findUnique({
    where: { id },
    include: { dossier: true }
  })

  if (!doc) return new NextResponse("Not Found", { status: 404 })
  if (doc.deletedAt) return new NextResponse("Document supprimé après expiration de la période de conservation.", { status: 410 })
  if (doc.expiresAt < new Date()) return new NextResponse("Document expiré", { status: 410 })

  const adminSession = await getAdminSession()

  if (!adminSession) {
    const client = await getCurrentClient()
    if (!client || doc.dossier.clientId !== client.id) {
      // Check TrackingSession
      const cookieStore = await cookies();
      const trackingSessionCookie = cookieStore.get('tracking_session')?.value;
      if (!trackingSessionCookie) {
        return new NextResponse("Unauthorized", { status: 403 })
      }

      const tokenHash = crypto.createHash('sha256').update(trackingSessionCookie).digest('hex')
      const trackingSession = await prisma.trackingSession.findUnique({
        where: { tokenHash }
      })

      if (!trackingSession ||
          trackingSession.revokedAt !== null ||
          trackingSession.expiresAt < new Date() ||
          trackingSession.dossierId !== doc.dossierId) {
        return new NextResponse("Unauthorized", { status: 403 })
      }
    }
  }

  const url = new URL(request.url);
  const versionParam = url.searchParams.get('version');

  let targetPath = doc.storagePath;
  if (versionParam === 'enhanced' && doc.enhancedStoragePath) {
    targetPath = doc.enhancedStoragePath;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(targetPath, 5 * 60) // 5 minutes

  if (error || !data) return new NextResponse("Signed URL error", { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}
