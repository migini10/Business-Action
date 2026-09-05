import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { getDossierDocumentsBucket } from '@/lib/supabase';
import { enhanceImageBuffer } from '@/lib/image-enhancer';
import crypto from 'crypto';

export const runtime = 'nodejs';

let supabaseInstance: any = null;
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseInstance && url && key) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase config error" }, { status: 500 });
    }

    let bucket: string;
    try {
      bucket = getDossierDocumentsBucket();
    } catch {
      return NextResponse.json({ success: false, error: "Storage bucket config error" }, { status: 500 });
    }

    const { id: documentId } = await params;
    const { mode, brightness, contrast, sharpness } = await request.json();

    const doc = await prisma.dossierDocument.findUnique({
      where: { id: documentId }
    });

    if (!doc) return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
    if (doc.deletedAt) return NextResponse.json({ success: false, error: "Document supprimé" }, { status: 400 });
    if (doc.expiresAt < new Date()) return NextResponse.json({ success: false, error: "Document expiré" }, { status: 400 });

    // 1. Download original
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucket)
      .download(doc.storagePath);

    if (fileError || !fileData) {
      return NextResponse.json({ success: false, error: "Original non trouvé" }, { status: 404 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 2. Enhance image
    const b = Number(brightness);
    const c = Number(contrast);
    const s = Number(sharpness);

    if (isNaN(b) || isNaN(c) || isNaN(s)) {
      return NextResponse.json({ success: false, error: "Paramètres invalides" }, { status: 400 });
    }

    const modeTyped = mode as 'Auto' | 'Clair' | 'Noir & Blanc';
    const processedBuffer = await enhanceImageBuffer(buffer, b, c, s, modeTyped, false);

    if (processedBuffer.length > 4 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "L'image améliorée dépasse 4MB" }, { status: 400 });
    }

    // 3. Upload new enhanced image
    const oldEnhancedPath = doc.enhancedStoragePath;
    const originalParts = doc.storagePath.split('/');
    const folderPath = originalParts.slice(0, 2).join('/');
    const originalFilename = originalParts[2];
    const prefixMatch = originalFilename.match(/^(recto|verso|single)-/);
    const sidePrefix = prefixMatch ? prefixMatch[1] : 'doc';
    const enhancedFileUuid = crypto.randomUUID();
    const newEnhancedStoragePath = `${folderPath}/${sidePrefix}-${enhancedFileUuid}-enhanced.jpeg`;

    const { data: eData, error: eErr } = await supabase.storage
      .from(bucket)
      .upload(newEnhancedStoragePath, processedBuffer, { contentType: 'image/jpeg' });

    if (eErr || !eData) {
      return NextResponse.json({ success: false, error: "Erreur lors de l'upload de l'image améliorée" }, { status: 500 });
    }

    // 4. Update Prisma
    try {
      await prisma.dossierDocument.update({
        where: { id: documentId },
        data: { enhancedStoragePath: newEnhancedStoragePath }
      });

      // 5. Success -> delete old enhanced if it exists
      if (oldEnhancedPath && oldEnhancedPath !== newEnhancedStoragePath) {
        await supabase.storage.from(bucket).remove([oldEnhancedPath]).catch((err: any) => console.error("Error cleaning old enhanced", err));
      }

      return NextResponse.json({ success: true, enhancedStoragePath: newEnhancedStoragePath });
    } catch (dbError) {
      // 6. Prisma failed -> rollback newly uploaded file
      await supabase.storage.from(bucket).remove([newEnhancedStoragePath]).catch((err: any) => console.error("Error rollback new enhanced", err));
      return NextResponse.json({ success: false, error: "Erreur lors de la mise à jour en base de données" }, { status: 500 });
    }

  } catch (error: any) {
    console.error("enhance-apply error:", error);
    return NextResponse.json({ success: false, error: "Erreur interne serveur" }, { status: 500 });
  }
}
