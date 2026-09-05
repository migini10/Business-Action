import { NextResponse } from 'next/server';
import { processMediaStagingJobs } from '@/lib/worker/media';

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers?.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processMediaStagingJobs();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Worker error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
