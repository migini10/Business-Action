'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function registerClient(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;

    if (!name || !phone || !password) {
      return { success: false, error: 'Tous les champs sont obligatoires.' };
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      return { success: false, error: 'Un compte existe déjà avec ce numéro de téléphone.' };
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer le client
    const user = await prisma.user.create({
      data: {
        fullName: name,
        phone,
        password: hashedPassword,
        role: 'CLIENT'
      }
    });

    return { 
      success: true, 
      user: {
        id: user.id,
        name: user.fullName,
        phone: user.phone
      }
    };
  } catch (error) {
    console.error('Erreur lors de la création du compte:', error);
    return { success: false, error: 'Une erreur est survenue lors de la création du compte.' };
  }
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

    return { 
      success: true, 
      user: {
        id: user.id,
        name: user.fullName,
        phone: user.phone
      }
    };
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return { success: false, error: 'Une erreur est survenue lors de la connexion.' };
  }
}
