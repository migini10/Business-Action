'use server'

import { getAdminSession } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { enhanceImageBuffer } from '@/lib/image-enhancer'
import crypto from 'crypto'

let supabaseInstance: any = null;
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseInstance && url && key) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export async function applyImageEnhancement(
  documentId: string,
  mode: string,
  brightness: number,
  contrast: number,
  sharpness: number
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase config error" };
  }

  const doc = await prisma.dossierDocument.findUnique({
    where: { id: documentId }
  });

  if (!doc) return { success: false, error: "Not Found" };
  if (doc.deletedAt) return { success: false, error: "Document supprimé" };
  if (doc.expiresAt < new Date()) return { success: false, error: "Document expiré" };

  try {
    // 1. Download original
    const { data: fileData, error: fileError } = await supabase.storage
      .from('dossier_documents')
      .download(doc.storagePath);

    if (fileError || !fileData) {
      return { success: false, error: "Original non trouvé" };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 2. Enhance image
    const b = Number(brightness);
    const c = Number(contrast);
    const s = Number(sharpness);

    if (isNaN(b) || isNaN(c) || isNaN(s)) {
      return { success: false, error: "Paramètres invalides" };
    }

    const modeTyped = mode as 'Auto' | 'Clair' | 'Noir & Blanc';
    const processedBuffer = await enhanceImageBuffer(buffer, b, c, s, modeTyped, false);

    if (processedBuffer.length > 4 * 1024 * 1024) {
      return { success: false, error: "L'image améliorée dépasse 4MB" };
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
      .from('dossier_documents')
      .upload(newEnhancedStoragePath, processedBuffer, { contentType: 'image/jpeg' });

    if (eErr || !eData) {
      return { success: false, error: "Erreur lors de l'upload de l'image améliorée" };
    }

    // 4. Update Prisma
    try {
      await prisma.dossierDocument.update({
        where: { id: documentId },
        data: { enhancedStoragePath: newEnhancedStoragePath }
      });

      // 5. Success -> delete old enhanced if it exists
      if (oldEnhancedPath && oldEnhancedPath !== newEnhancedStoragePath) {
        await supabase.storage.from('dossier_documents').remove([oldEnhancedPath]).catch((err: any) => console.error("Error cleaning old enhanced", err));
      }

      return { success: true, enhancedStoragePath: newEnhancedStoragePath };
    } catch (dbError) {
      // 6. Prisma failed -> rollback newly uploaded file
      await supabase.storage.from('dossier_documents').remove([newEnhancedStoragePath]).catch((err: any) => console.error("Error rollback new enhanced", err));
      return { success: false, error: "Erreur lors de la mise à jour en base de données" };
    }

  } catch (error: any) {
    console.error("applyImageEnhancement error:", error);
    return { success: false, error: "Erreur interne serveur" };
  }
}
