import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOtpSecret, hashString, signResetSession } from '@/lib/password-reset-crypto';

// Origine publique de confiance pour les redirections. Ne jamais dériver cette
// valeur de request.url (reflète l'adresse d'écoute interne de next start derrière
// un reverse-proxy) ni d'un header Host/X-Forwarded-Host (falsifiable par l'appelant).
// Repli sur localhost:3000 uniquement pour le développement local sans APP_BASE_URL.
function getTrustedBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000';
}

// --- Internal logic for testing (dependency injection) ---
// Le token brut n'est utilisé qu'ici, une seule fois, pour retrouver le challenge.
// Il n'est jamais renvoyé à l'appelant : seul l'id (non sensible) et l'expiration
// du challenge sont retournés, pour permettre au caller de forger la session signée.
export async function _verifyResetToken(token: string | null, deps: any) {
  if (!token) {
    return { success: false };
  }

  try {
    const secret = getOtpSecret(deps.otpSecret);
    const tokenHash = hashString(token, secret);

    const challenge = await deps.db.passwordResetChallenge.findFirst({
      where: {
        resetTokenHash: tokenHash,
        purpose: 'PASSWORD_RESET',
        usedAt: null,
        verifiedAt: { not: null },
      },
    });

    if (!challenge) {
      return { success: false };
    }

    if (!challenge.resetTokenExpiresAt || challenge.resetTokenExpiresAt < new Date(deps.now())) {
      return { success: false };
    }

    // Le challenge est valide, on ne le consomme pas encore (GET est idempotent).
    // La consommation définitive n'a lieu que dans updatePassword().
    return { success: true, challengeId: challenge.id as string, expiresAt: challenge.resetTokenExpiresAt as Date };
  } catch (err) {
    console.error('Erreur lors de la vérification du lien de reset:', err);
    return { success: false };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  const trustedBaseUrl = getTrustedBaseUrl();

  const errorUrl = new URL('/mot-de-passe-oublie', trustedBaseUrl);
  errorUrl.searchParams.set('error', 'Ce lien de réinitialisation est invalide, expiré, ou a déjà été utilisé.');

  const otpSecret = process.env.PASSWORD_RESET_OTP_SECRET;

  const result = await _verifyResetToken(token, {
    db: prisma,
    now: () => Date.now(),
    otpSecret,
  });

  if (!result.success || !result.challengeId || !result.expiresAt) {
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Le token WhatsApp brut s'arrête ici : il n'est jamais placé dans le cookie.
    // La session temporaire est une enveloppe signée (HMAC) qui ne référence le
    // challenge que par son id, avec une durée bornée par l'expiration réelle du challenge.
    const secret = getOtpSecret(otpSecret);
    const sessionValue = signResetSession({ challengeId: result.challengeId, exp: result.expiresAt.getTime() }, secret);
    const maxAge = Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));

    const successUrl = new URL('/mot-de-passe-oublie', trustedBaseUrl);
    successUrl.searchParams.set('step', '3');

    const response = NextResponse.redirect(successUrl);

    response.cookies.set('password_reset_session', sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return response;
  } catch (err) {
    console.error('Erreur lors de la création de la session de réinitialisation:', err);
    return NextResponse.redirect(errorUrl);
  }
}
