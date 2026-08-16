import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ publicKey: process.env.WEB_PUSH_PUBLIC_KEY });
  } catch {
    return NextResponse.json({ error: 'Unauthorized or internal error' }, { status: 401 });
  }
}
