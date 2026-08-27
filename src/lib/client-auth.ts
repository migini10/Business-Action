import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'client_session';
const SESSION_DURATION_DAYS = 7;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createClientSession(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.clientSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getCurrentClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = await prisma.clientSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  if (session.user.mustChangePassword) {
    // Révocation de sécurité silencieuse si le flag a été forcé
    await prisma.clientSession.deleteMany({
      where: { userId: session.user.id }
    });
    return null;
  }

  return session.user;
}

export async function requireClient() {
  const client = await getCurrentClient();
  if (!client) {
    throw new Error('Non autorisé. Veuillez vous connecter.');
  }
  return client;
}

export async function revokeClientSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    // Supprimer la session courante. Si absente (idempotent), l'erreur Prisma est ignorée ou capturée par le deleteMany
    await prisma.clientSession.deleteMany({
      where: { tokenHash },
    });
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function revokeAllClientSessions(userId: string) {
  await prisma.clientSession.deleteMany({
    where: { userId },
  });
}
