import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabase, getDossierDocumentsBucket } from '@/lib/supabase';

async function checkFileExists(bucket: string, path: string) {
  const supabase = getSupabase();
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

  const supabase = getSupabase();
  let processedCleanup = 0;
  let processedOrphans = 0;

  try {
    const bucket = getDossierDocumentsBucket();

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

      const { error } = await supabase.storage.from(bucket).remove(pathsToRemove);

      let absentConfirmed = true;
      for (const path of pathsToRemove) {
        const exists = await checkFileExists(bucket, path);
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
    // A2. CLEANUP STAGING (J+7)
    // ---------------------------------------------------------
    const expiredStaging = await prisma.mediaStaging.findMany({
      where: {
        expiresAt: { lte: now }
      },
      take: 100
    });

    let processedStaging = 0;
    for (const media of expiredStaging) {
      if (media.storagePath) {
        await supabase.storage.from(bucket).remove([media.storagePath]);
      }
      await prisma.mediaStaging.delete({
        where: { id: media.id }
      });
      processedStaging++;
    }

    // ---------------------------------------------------------
    // B. ORPHAN RECOVERY
    // ---------------------------------------------------------
    // Fail-closed: this section lists the entire bucket and deletes files with
    // no matching DB row. It must never run without an explicit opt-in, since a
    // dev/preview DB that doesn't know about Production's documents would treat
    // every real Production file as an orphan.
    if (process.env.ENABLE_STORAGE_ORPHAN_CLEANUP === 'true') {
      // List root folders (Upload UUIDs) - pagination is hardcoded to 100 here for Vercel limits
      const { data: rootItems, error: rootError } = await supabase.storage.from(bucket).list('', { limit: 100, offset: 0 });

      if (!rootError && rootItems) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const rootItem of rootItems) {
          if (!rootItem.id) { // Usually folders don't have IDs in Supabase list, they represent prefixes
            // List subfolders 'carte-grise' or 'cmc'
            const subfolders = ['carte-grise', 'cmc'];
            for (const sub of subfolders) {
              const folderPath = `${rootItem.name}/${sub}`;
              const { data: files, error: filesError } = await supabase.storage.from(bucket).list(folderPath, { limit: 100 });

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
                        await supabase.storage.from(bucket).remove([exactStoragePath]);
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
    }


    // ---------------------------------------------------------
    // C. RATE LIMIT CLEANUP
    // ---------------------------------------------------------
    await prisma.rateLimitWindow.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });
    return NextResponse.json({ success: true, cleanup: processedCleanup, stagingCleanup: processedStaging, orphans: processedOrphans });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}
