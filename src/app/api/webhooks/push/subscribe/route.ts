import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const subscription = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const auth = subscription.keys?.auth;
    const p256dh = subscription.keys?.p256dh;

    if (!auth || !p256dh) {
      return NextResponse.json({ error: 'Missing keys' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        auth,
        p256dh,
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
      create: {
        endpoint: subscription.endpoint,
        auth,
        p256dh,
        userAgent: req.headers.get('user-agent') || 'Unknown',
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Unauthorized or internal error' }, { status: 401 });
  }
}
