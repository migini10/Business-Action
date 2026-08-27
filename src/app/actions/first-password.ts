'use server';

import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClientSession } from '@/lib/client-auth';
import { validatePasswordPolicy } from '@/lib/password-policy';

// Injection de dépendances pour les tests
export async function _executeFirstPasswordChange(newPassword: string, deps: any) {
  const cookieStore = await deps.cookies();
  const token = cookieStore.get('first_password_token')?.value;

  if (!token) {
    return { success: false, error: 'Session de changement de mot de passe invalide ou expirée.' };
  }

  const passwordCheck = deps.validatePasswordPolicy ? deps.validatePasswordPolicy(newPassword) : { isValid: true };
  if (!passwordCheck.isValid) {
    return { success: false, error: passwordCheck.error };
  }

  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const result = await deps.db.$transaction(async (tx: any) => {
      const challenge = await tx.passwordResetChallenge.findFirst({
        where: {
          resetTokenHash,
          purpose: 'FIRST_PASSWORD_CHANGE',
          usedAt: null,
          verifiedAt: { not: null },
        }
      });

      if (!challenge || challenge.resetTokenExpiresAt < new Date(deps.now())) {
        return { success: false, error: 'Session invalide ou expirée.' };
      }

      // Consommation conditionnelle atomique
      const updateRes = await tx.passwordResetChallenge.updateMany({
        where: {
          id: challenge.id,
          userId: challenge.userId,
          purpose: 'FIRST_PASSWORD_CHANGE',
          usedAt: null,
          resetTokenHash,
          resetTokenExpiresAt: { gt: new Date(deps.now()) }
        },
        data: { usedAt: new Date(deps.now()) }
      });

      if (updateRes.count !== 1) {
        return { success: false, error: 'Session déjà utilisée ou invalide.' };
      }

      const hashedPassword = await deps.hash(newPassword);

      await tx.user.update({
        where: { id: challenge.userId },
        data: { 
          password: hashedPassword,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null
        }
      });

      await tx.clientSession.deleteMany({
        where: { userId: challenge.userId }
      });

      return { success: true, userId: challenge.userId };
    });

    if (!result.success) return result;

    cookieStore.delete('first_password_token');

    // On crée la vraie session après le succès de la transaction
    if (deps.createSession && result.userId) {
      await deps.createSession(result.userId);
    }

    return { success: true };
  } catch (err) {
    console.error('Erreur lors du changement de mot de passe obligatoire:', err);
    return { success: false, error: 'Erreur lors du changement de mot de passe.' };
  }
}

export async function executeFirstPasswordChange(newPassword: string) {
  return _executeFirstPasswordChange(newPassword, {
    db: prisma,
    hash: (p: string) => bcrypt.hash(p, 10),
    now: () => Date.now(),
    cookies,
    createSession: createClientSession,
    validatePasswordPolicy
  });
}
