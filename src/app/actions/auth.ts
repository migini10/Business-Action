'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createClientSession, getCurrentClient, revokeClientSession } from '@/lib/client-auth';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { validatePasswordPolicy } from '@/lib/password-policy';

export async function _registerClient(formData: FormData, deps: { db: any; hash: (p: string) => Promise<string>; createSession?: (id: string) => Promise<void> }) {
  try {
    const name = formData.get('name') as string;
    const rawPhone = formData.get('phone') as string;
    const password = formData.get('password') as string;
    const rawEmail = formData.get('email') as string | null;

    if (!name || !rawPhone || !password) {
      return { success: false, error: 'Tous les champs obligatoires doivent être remplis.' };
    }

    const phone = rawPhone.trim();
    if (!phone) {
      return { success: false, error: 'Tous les champs obligatoires doivent être remplis.' };
    }

    const passwordCheck = validatePasswordPolicy(password);
    if (!passwordCheck.isValid) {
      return { success: false, error: passwordCheck.error, field: 'password' };
    }

    let email: string | null = null;
    if (rawEmail && rawEmail.trim() !== '') {
      email = rawEmail.trim().toLowerCase();
      // Simple server-side email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Le format de l\'adresse email est invalide.', field: 'email' };
      }
    }

    // Vérifier si l'utilisateur existe déjà par téléphone
    const existingPhone = await deps.db.user.findUnique({
      where: { phone }
    });

    if (existingPhone) {
      return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.', field: 'phone' };
    }

    // Vérifier l'email si présent
    if (email) {
      const existingEmail = await deps.db.user.findUnique({
        where: { email }
      });
      if (existingEmail) {
        return { success: false, error: 'Cette adresse email est déjà utilisée.', field: 'email' };
      }
    }

    // Hasher le mot de passe
    const hashedPassword = await deps.hash(password);

    // Créer le client
    try {
      const user = await deps.db.user.create({
        data: {
          fullName: name,
          phone,
          email,
          password: hashedPassword,
          role: 'CLIENT'
        }
      });

      if (deps.createSession) {
        await deps.createSession(user.id);
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.fullName,
          phone: user.phone,
          email: user.email
        }
      };
    } catch (dbError: any) {
      // Gestion propre de l'erreur Prisma UNIQUE (P2002) pour prévenir les race conditions
      if (dbError.code === 'P2002') {
        const target = dbError.meta?.target || [];
        if (target.includes('email')) {
          return { success: false, error: 'Cette adresse email est déjà utilisée.', field: 'email' };
        }
        if (target.includes('phone')) {
          return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.', field: 'phone' };
        }
      }
      throw dbError; // Relance l'erreur pour le bloc catch global
    }
  } catch (error) {
    console.error('Erreur lors de la création du compte:', error);
    return { success: false, error: 'Une erreur est survenue lors de la création du compte.' };
  }
}

export async function registerClient(formData: FormData) {
  return _registerClient(formData, {
    db: prisma,
    hash: (p: string) => bcrypt.hash(p, 10),
    createSession: createClientSession
  });
}

export async function loginClient(formData: FormData) {
  try {
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;

    if (!phone || !password) {
      return { success: false, error: 'Téléphone et mot de passe requis.' };
    }

    const user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      return { success: false, error: 'Numéro de téléphone ou mot de passe incorrect.' };
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return { success: false, error: 'Numéro de téléphone ou mot de passe incorrect.' };
    }

    if (user.mustChangePassword) {
      const authResult = await prisma.$transaction(async (tx) => {
        // Verrouiller la ligne User pour sérialiser
        const lockedUserArr = await tx.$queryRaw<any[]>`SELECT id, "mustChangePassword", "temporaryPasswordExpiresAt" FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        const lockedUser = lockedUserArr[0];

        if (!lockedUser) {
          throw new Error('Utilisateur introuvable.');
        }

        if (lockedUser.mustChangePassword) {
          if (!lockedUser.temporaryPasswordExpiresAt || lockedUser.temporaryPasswordExpiresAt <= new Date()) {
            return { success: false, error: 'Mot de passe temporaire expiré. Veuillez réinitialiser votre mot de passe.' };
          }

          // Rechercher un challenge FIRST_PASSWORD_CHANGE actif
          const activeChallenge = await tx.passwordResetChallenge.findFirst({
            where: {
              userId: user.id,
              purpose: 'FIRST_PASSWORD_CHANGE',
              usedAt: null,
              resetTokenExpiresAt: { gt: new Date() }
            }
          });

          if (activeChallenge) {
             // Il en existe déjà un actif. On ne fait rien et on ne renvoie pas de nouveau token.
             // On avertit le code appelant de NE PAS écraser le cookie existant.
             return { success: true, requireFirstPasswordChange: true, challengeAlreadyActive: true, activeResetTokenHash: activeChallenge.resetTokenHash };
          }

          // Invalider les anciens challenges FIRST_PASSWORD_CHANGE expirés
          await tx.passwordResetChallenge.updateMany({
            where: { userId: user.id, purpose: 'FIRST_PASSWORD_CHANGE', usedAt: null },
            data: { usedAt: new Date() }
          });

          const resetToken = crypto.randomBytes(32).toString('hex');
          const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
          const dummyOtpHash = crypto.createHash('sha256').update(crypto.randomBytes(16)).digest('hex');

          await tx.passwordResetChallenge.create({
            data: {
              userId: user.id,
              purpose: 'FIRST_PASSWORD_CHANGE',
              otpHash: dummyOtpHash,
              resetTokenHash,
              resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
              expiresAt: new Date(Date.now() + 15 * 60 * 1000), // otp expiry (unused here but required)
              verifiedAt: new Date(), // Déjà vérifié car login réussi
            }
          });

          return { success: true, requireFirstPasswordChange: true, resetToken };
        }
        return { success: true, requireFirstPasswordChange: false };
      });

      if (!authResult.success) {
        return authResult;
      }

      if (authResult.requireFirstPasswordChange) {
        if (authResult.challengeAlreadyActive) {
          // Si le challenge est actif, vérifier que le navigateur a déjà un cookie correspondant
          const cookieStore = await cookies();
          const existingCookie = cookieStore.get('first_password_token')?.value;
          if (!existingCookie) {
            // Le challenge est en cours mais le navigateur n'a pas le cookie
            return { success: false, firstPasswordChangeAlreadyInProgress: true };
          }

          // HASHER LE COOKIE ET COMPARER AVEC LE TOKEN ACTIF
          const existingCookieHash = crypto.createHash('sha256').update(existingCookie).digest('hex');
          if (existingCookieHash !== authResult.activeResetTokenHash) {
            // Le cookie existe mais ne correspond pas (ex: ancien test / autre navigateur)
            return { success: false, firstPasswordChangeAlreadyInProgress: true };
          }
          // Si le cookie est présent et valide, on laisse continuer
        } else if (authResult.resetToken) {
          // Nouveau challenge, on écrit le cookie
          const cookieStore = await cookies();
          cookieStore.set('first_password_token', authResult.resetToken as string, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60, // 15 min
          });
        }
        return { success: true, requireFirstPasswordChange: true };
      }
    }

    await createClientSession(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        name: user.fullName,
        phone: user.phone,
        email: user.email
      }
    };
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return { success: false, error: 'Une erreur est survenue lors de la connexion.' };
  }
}

export async function logoutClient() {
  try {
    await revokeClientSession();
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    return { success: false, error: 'Une erreur est survenue' };
  }
}

export async function getCurrentClientData() {
  try {
    const user = await getCurrentClient();
    if (!user) {
      return { success: false };
    }
    return {
      success: true,
      user: {
        id: user.id,
        name: user.fullName,
        phone: user.phone,
        email: user.email
      }
    };
  } catch {
    return { success: false };
  }
}
