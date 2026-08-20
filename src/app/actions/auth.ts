'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createClientSession, getCurrentClient, revokeClientSession } from '@/lib/client-auth';

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
