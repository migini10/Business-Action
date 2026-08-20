import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { enhanceImageBuffer } from '@/lib/image-enhancer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!supabase) return new NextResponse("Supabase config error", { status: 500 })

  const adminSession = await getAdminSession()
  if (!adminSession) {
    return new NextResponse("Unauthorized", { status: 403 })
  }

  const doc = await prisma.dossierDocument.findUnique({
    where: { id }
  })

  if (!doc) return new NextResponse("Not Found", { status: 404 })
  if (doc.deletedAt) return new NextResponse("Document supprimé", { status: 410 })
  if (doc.expiresAt < new Date()) return new NextResponse("Document expiré", { status: 410 })

  try {
    const { mode, brightness, contrast, sharpness } = await request.json()

    // Retrieve original from Supabase
    const { data: fileData, error: fileError } = await supabase.storage
      .from('dossier_documents')
      .download(doc.storagePath)

    if (fileError || !fileData) {
      return new NextResponse("Original non trouvé", { status: 404 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Convert values safely (prevent NaN)
    const b = Number(brightness);
    const c = Number(contrast);
    const s = Number(sharpness);

    if (isNaN(b) || isNaN(c) || isNaN(s)) {
      return new NextResponse("Paramètres invalides", { status: 400 })
    }

    // Grayscale logic is now handled internally based on mode
    const processedBuffer = await enhanceImageBuffer(buffer, b, c, s, mode, true);

    return new NextResponse(processedBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error("Erreur lors de la preview:", error)
    return new NextResponse("Erreur de traitement", { status: 500 })
  }
}
