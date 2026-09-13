import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// The secret must be present for the reset process to work safely
const getOtpSecret = () => {
  const secret = process.env.PASSWORD_RESET_OTP_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_OTP_SECRET is missing');
  return secret;
};

// Hashes a string (Reset Token)
function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Origine publique de confiance pour les redirections. Ne jamais dériver cette
// valeur de request.url (reflète l'adresse d'écoute interne de next start derrière
// un reverse-proxy) ni d'un header Host/X-Forwarded-Host (falsifiable par l'appelant).
// Repli sur localhost:3000 uniquement pour le développement local sans APP_BASE_URL.
function getTrustedBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  const trustedBaseUrl = getTrustedBaseUrl();

  const errorUrl = new URL('/mot-de-passe-oublie', trustedBaseUrl);
  errorUrl.searchParams.set('error', 'Ce lien de réinitialisation est invalide, expiré, ou a déjà été utilisé.');

  if (!token) {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const secret = getOtpSecret();
    const tokenHash = hashString(token, secret);

    const challenge = await prisma.passwordResetChallenge.findFirst({
      where: {
        resetTokenHash: tokenHash,
        purpose: 'PASSWORD_RESET',
        usedAt: null,
      },
    });

    if (!challenge) {
      return NextResponse.redirect(errorUrl);
    }

    if (!challenge.resetTokenExpiresAt || challenge.resetTokenExpiresAt < new Date()) {
      return NextResponse.redirect(errorUrl);
    }

    // Le challenge est valide, on ne le consomme pas encore (GET est idempotent).
    // On pose simplement le cookie et on redirige pour masquer le token.
    
    const successUrl = new URL('/mot-de-passe-oublie', trustedBaseUrl);
    successUrl.searchParams.set('step', '3');

    const response = NextResponse.redirect(successUrl);
    
    response.cookies.set('password_reset_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 min
    });

    return response;
  } catch (err) {
    console.error('Erreur lors de la vérification du lien de reset:', err);
    errorUrl.searchParams.set('error', 'Une erreur inattendue est survenue.');
    return NextResponse.redirect(errorUrl);
  }
}
