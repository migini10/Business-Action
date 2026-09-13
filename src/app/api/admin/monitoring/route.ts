import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getMonitoringData } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
  }

  try {
    const data = await getMonitoringData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Monitoring indisponible' }, { status: 500 });
  }
}
