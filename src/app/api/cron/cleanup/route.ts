import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function checkFileExists(bucket: string, path: string) {
  if (!supabase) return false;
  // To check if a file exists, we can try to create a signed URL or list its directory
  const folder = path.substring(0, path.lastIndexOf('/'));
  const filename = path.substring(path.lastIndexOf('/') + 1);
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    search: filename
  });
  if (error) return null; // ambiguous
  return data && data.length > 0;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
  }

  let processedCleanup = 0;
  let processedOrphans = 0;

  try {
    // ---------------------------------------------------------
    // A. CLEANUP J+7
    // ---------------------------------------------------------
    const expiredDocs = await prisma.dossierDocument.findMany({
      where: {
        expiresAt: { lte: new Date() },
        deletedAt: null
      },
      take: 100
    });

    const now = new Date();
    for (const doc of expiredDocs) {
      const pathsToRemove = [doc.storagePath];
      if (doc.enhancedStoragePath) pathsToRemove.push(doc.enhancedStoragePath);

      const { error } = await supabase.storage.from('dossier_documents').remove(pathsToRemove);

      let absentConfirmed = true;
      for (const path of pathsToRemove) {
        const exists = await checkFileExists('dossier_documents', path);
        if (exists === true) {
          absentConfirmed = false;
        }
      }

      if (absentConfirmed) {
        await prisma.dossierDocument.update({
          where: { id: doc.id },
          data: { deletedAt: now }
        });
        processedCleanup++;
      }
    }

    // ---------------------------------------------------------
    // B. ORPHAN RECOVERY
    // ---------------------------------------------------------
    // List root folders (Upload UUIDs) - pagination is hardcoded to 100 here for Vercel limits
    const { data: rootItems, error: rootError } = await supabase.storage.from('dossier_documents').list('', { limit: 100, offset: 0 });

    if (!rootError && rootItems) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const rootItem of rootItems) {
        if (!rootItem.id) { // Usually folders don't have IDs in Supabase list, they represent prefixes
          // List subfolders 'carte-grise' or 'cmc'
          const subfolders = ['carte-grise', 'cmc'];
          for (const sub of subfolders) {
            const folderPath = `${rootItem.name}/${sub}`;
            const { data: files, error: filesError } = await supabase.storage.from('dossier_documents').list(folderPath, { limit: 100 });

            if (!filesError && files) {
              for (const file of files) {
                if (file.name === '.emptyFolderPlaceholder') continue;

                if (!file.created_at) continue; // Etat ambigu => conserver
                const fileCreatedAt = new Date(file.created_at);
                if (fileCreatedAt < oneDayAgo) {
                  const exactStoragePath = `${folderPath}/${file.name}`;
                  // Verify exact storagePath or enhancedStoragePath in Prisma
                  try {
                    const docInDb = await prisma.dossierDocument.findFirst({
                      where: {
                        OR: [
                          { storagePath: exactStoragePath },
                          { enhancedStoragePath: exactStoragePath }
                        ]
                      }
                    });

                    if (!docInDb) {
                      // Absent confirmé => suppression
                      await supabase.storage.from('dossier_documents').remove([exactStoragePath]);
                      processedOrphans++;
                    }
                  } catch (e) {
                    // Etat ambigu (DB error) => aucune suppression
                  }
                }
              }
            }
          }
        }
      }
    }


    // ---------------------------------------------------------
    // C. RATE LIMIT CLEANUP
    // ---------------------------------------------------------
    await prisma.rateLimitWindow.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });
    return NextResponse.json({ success: true, cleanup: processedCleanup, orphans: processedOrphans });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}
