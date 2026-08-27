'use server';

import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { Resend } from 'resend';
import { validatePasswordPolicy } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

// The secret must be present for the reset process to work safely
const getOtpSecret = (secretOverride?: string) => {
  const secret = secretOverride || process.env.PASSWORD_RESET_OTP_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_OTP_SECRET is missing');
  return secret;
};

// Generates a 6-digit OTP
function generateOTP(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// Hashes a string (OTP or Reset Token)
function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// --- Internal logic functions for testing (dependency injection) ---

export async function _requestPasswordReset(phone: string, deps: any) {
  try {
    const secret = getOtpSecret(deps.otpSecret);
    const user = await deps.db.user.findUnique({ where: { phone } });

    const successMessage = {
      success: true,
      message: 'Si un compte correspondant existe, les instructions de récupération ont été envoyées.',
    };

    if (!user) {
      return successMessage;
    }

    const threeMinutesAgo = new Date(deps.now() - 3 * 60 * 1000);
    const recentChallenge = await deps.db.passwordResetChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        createdAt: { gte: threeMinutesAgo },
      },
    });

    if (recentChallenge) {
      return { success: false, error: 'Veuillez patienter 3 minutes avant de demander un nouveau code.' };
    }

    const otp = deps.generateOTP();
    const otpHash = hashString(otp, secret);
    const expiresAt = new Date(deps.now() + 15 * 60 * 1000);

    await deps.db.passwordResetChallenge.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date(deps.now()) },
    });

    await deps.db.passwordResetChallenge.create({
      data: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        otpHash,
        expiresAt,
        createdAt: new Date(deps.now()),
      },
    });

    if (user.email && deps.resendConfigured) {
      try {
        await deps.sendEmail(user.email, otp);
      } catch (err) {
        // silent catch
      }
    }

    return successMessage;
  } catch (error) {
    return { success: false, error: 'Une erreur est survenue' };
  }
}

export async function _verifyOTP(phone: string, otp: string, deps: any) {
  try {
    const secret = getOtpSecret(deps.otpSecret);
    const user = await deps.db.user.findUnique({ where: { phone } });
    if (!user) return { success: false, error: 'Code invalide ou expiré' };

    const challenge = await deps.db.passwordResetChallenge.findFirst({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) return { success: false, error: 'Aucune demande de réinitialisation en cours' };
    if (challenge.expiresAt < new Date(deps.now())) return { success: false, error: 'Le code a expiré' };

    if (challenge.attempts >= 3) {
      await deps.db.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: new Date(deps.now()) },
      });
      return { success: false, error: 'Trop de tentatives, demande annulée' };
    }

    const expectedHashBuf = Buffer.from(challenge.otpHash, 'hex');
    const providedHashBuf = Buffer.from(hashString(otp, secret), 'hex');

    let isValid = false;
    if (expectedHashBuf.length === providedHashBuf.length) {
      isValid = crypto.timingSafeEqual(expectedHashBuf, providedHashBuf);
    }

    if (!isValid) {
      await deps.db.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return { success: false, error: 'Code incorrect' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashString(resetToken, secret);
    const resetTokenExpiresAt = new Date(deps.now() + 15 * 60 * 1000);

    await deps.db.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: {
        verifiedAt: new Date(deps.now()),
        resetTokenHash,
        resetTokenExpiresAt,
      },
    });

    await deps.setCookie('password_reset_token', resetToken, {
      httpOnly: true,
      secure: deps.isProduction,
      sameSite: 'lax',
      path: '/mot-de-passe-oublie',
      maxAge: 15 * 60,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Une erreur est survenue' };
  }
}

export async function _updatePassword(newPassword: string, deps: any) {
  try {
    const secret = getOtpSecret(deps.otpSecret);
    const tokenCookie = await deps.getCookie('password_reset_token');

    if (!tokenCookie) {
      return { success: false, error: 'Session de réinitialisation invalide ou expirée' };
    }

    const passwordCheck = deps.validatePasswordPolicy ? deps.validatePasswordPolicy(newPassword) : { isValid: true };
    if (!passwordCheck.isValid) {
      return { success: false, error: passwordCheck.error };
    }

    const resetToken = tokenCookie;
    const resetTokenHash = hashString(resetToken, secret);

    const challenge = await deps.db.passwordResetChallenge.findFirst({
      where: {
        resetTokenHash,
        purpose: 'PASSWORD_RESET',
        usedAt: null,
        verifiedAt: { not: null },
      },
      include: { user: true },
    });

    if (!challenge) return { success: false, error: 'Demande non valide ou déjà utilisée' };
    if (!challenge.resetTokenExpiresAt || challenge.resetTokenExpiresAt < new Date(deps.now())) {
      return { success: false, error: 'Le jeton de réinitialisation a expiré' };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await deps.db.$transaction([
      deps.db.user.update({
        where: { id: challenge.userId },
        data: { password: newPasswordHash },
      }),
      deps.db.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: new Date(deps.now()) },
      }),
      deps.db.passwordResetChallenge.updateMany({
        where: { userId: challenge.userId, id: { not: challenge.id }, usedAt: null },
        data: { usedAt: new Date(deps.now()) },
      }),
      deps.db.clientSession.deleteMany({
        where: { userId: challenge.userId },
      }),
    ]);

    await deps.deleteCookie('password_reset_token');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Une erreur est survenue' };
  }
}

// --- Public Server Actions ---

export async function requestPasswordReset(phone: string) {
  return _requestPasswordReset(phone, {
    db: prisma,
    now: () => Date.now(),
    otpSecret: process.env.PASSWORD_RESET_OTP_SECRET,
    generateOTP,
    resendConfigured: !!process.env.RESEND_API_KEY,
    sendEmail: async (email: string, otp: string) => {
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      if (!fromEmail) throw new Error('RESEND_FROM_EMAIL is not configured');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Réinitialisation de votre mot de passe Business Action',
        text: `Nous avons reçu une demande de réinitialisation du mot de passe de votre Espace Client Business Action.\n\nVotre code de réinitialisation est : ${otp}\n\nCe code est valable pendant 15 minutes.\n\nNe communiquez jamais ce code à une autre personne. Business Action ne vous demandera jamais ce code par téléphone, WhatsApp ou email.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email. Votre mot de passe restera inchangé.\n\nL'équipe Business Action\nwww.businessaction.sn`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
            <div style="margin: 0 auto; background-color: #ffffff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 500px;">
              <h1 style="color: #2563eb; font-size: 24px; font-weight: 800; text-align: center; margin-top: 0;">Business Action</h1>
              <p style="font-size: 16px; line-height: 1.5; text-align: center; color: #4b5563;">
                Nous avons reçu une demande de réinitialisation du mot de passe de votre Espace Client Business Action.
              </p>

              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Votre code de sécurité</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #111827; margin-top: 10px;">${otp}</div>
              </div>

              <p style="font-size: 14px; color: #4b5563; text-align: center; font-weight: 600;">
                Ce code est valable pendant 15 minutes.
              </p>

              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 30px;">
                <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
                  <strong>Attention :</strong> Ne communiquez jamais ce code à une autre personne. Business Action ne vous demandera jamais ce code par téléphone, WhatsApp ou email.
                </p>
              </div>

              <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email. Votre mot de passe restera inchangé.
              </p>

              <div style="margin-top: 30px; text-align: center;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">L'équipe Business Action</p>
                <a href="https://www.businessaction.sn" style="color: #2563eb; text-decoration: none; font-size: 13px;">www.businessaction.sn</a>
              </div>
            </div>
          </div>
        `
      });
    }
  });
}

export async function verifyOTP(phone: string, otp: string) {
  return _verifyOTP(phone, otp, {
    db: prisma,
    now: () => Date.now(),
    otpSecret: process.env.PASSWORD_RESET_OTP_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
    setCookie: async (name: string, value: string, options: any) => {
      const cookieStore = await cookies();
      cookieStore.set(name, value, options);
    }
  });
}

export async function updatePassword(newPassword: string) {
  return _updatePassword(newPassword, {
    db: prisma,
    now: () => Date.now(),
    otpSecret: process.env.PASSWORD_RESET_OTP_SECRET,
    getCookie: async (name: string) => {
      const cookieStore = await cookies();
      return cookieStore.get(name)?.value;
    },
    deleteCookie: async (name: string) => {
      const cookieStore = await cookies();
      cookieStore.delete(name);
    },
    validatePasswordPolicy
  });
}
