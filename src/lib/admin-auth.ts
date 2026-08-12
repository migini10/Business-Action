import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_EXPIRATION_MS = 8 * 60 * 60 * 1000; // 8 heures

export async function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);

  await prisma.adminSession.create({
    data: {
      tokenHash,
      expiresAt,
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRATION_MS / 1000,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash }
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function revokeAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.adminSession.update({
      where: { tokenHash },
      data: { revokedAt: new Date() }
    }).catch(() => {});
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
