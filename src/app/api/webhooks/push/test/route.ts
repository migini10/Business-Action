import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendPushNotificationSafe } from '@/lib/push/send-push';

export async function POST() {
  try {
    await requireAdmin();
    // This will send to ALL admins, which is acceptable for a test push,
    // though in a multi-admin setup we might filter by endpoint if provided.
    
    await sendPushNotificationSafe({
      title: 'Business Action',
      body: 'Ceci est une notification de test de Business Action.',
      url: '/admin'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Test push error:', error);
    return NextResponse.json({ error: 'Unauthorized or internal error' }, { status: 401 });
  }
}
