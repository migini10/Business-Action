import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabase, getDossierDocumentsBucket } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const expectedSlot = formData.get('expectedSlot') as string | null;

    if (!file || !expectedSlot) {
      return NextResponse.json({ error: 'Missing file or expectedSlot' }, { status: 400 });
    }

    // Validation
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const validMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabase();
    const bucket = getDossierDocumentsBucket();

    // Upload direct staging
    const opaqueId = randomUUID();
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `staging/${opaqueId}/file.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Insert to DB as STORED
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const media = await prisma.mediaStaging.create({
      data: {
        source: 'WEB',
        expectedSlot: expectedSlot as any,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'STORED',
        expiresAt,
      }
    });

    return NextResponse.json({ success: true, mediaId: media.id });

  } catch (error) {
    console.error('Web upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
