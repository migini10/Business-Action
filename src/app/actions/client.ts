'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireClient } from '@/lib/client-auth'
import { normalizeTransactionAmount } from '@/lib/finance'

export async function getClientDashboardData() {
  try {
    const user = await requireClient();
    const clientId = user.id;

    const dossiers = await prisma.dossier.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });

    const transactions = await prisma.transaction.findMany({
      where: { clientId },
      orderBy: { date: 'desc' }
    });

    return { success: true, dossiers, transactions };
  } catch (error) {
    console.error("Erreur récupération données client:", error);
    return { success: false, error: "Impossible de récupérer les données." };
  }
}

export async function respondToTransactionModification(transactionId: string, accept: boolean) {
  try {
    const user = await requireClient();
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });

    if (!transaction || !transaction.isModificationPending || !transaction.pendingModification) {
      return { success: false, error: "Aucune modification en attente." };
    }

    if (transaction.clientId !== user.id) {
      return { success: false, error: "Non autorisé." };
    }

    if (accept) {
      const pending = transaction.pendingModification as any;
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          montant: normalizeTransactionAmount(pending.montant),
          type: pending.type,
          description: pending.description,
          commentaire: pending.commentaire,
          isModificationPending: false,
          pendingModification: Prisma.DbNull
        }
      });
      return { success: true, message: "Modification acceptée." };
    } else {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isModificationPending: false,
          pendingModification: Prisma.DbNull
        }
      });
      return { success: true, message: "Modification refusée." };
    }
  } catch (error) {
    console.error("Erreur réponse modification:", error);
    return { success: false, error: "Erreur lors du traitement." };
  }
}

export interface UpdateClientProfileDeps {
  db: {
    user: {
      update: (args: Prisma.UserUpdateArgs) => Promise<{
        id: string;
        fullName: string | null;
        phone: string;
        email: string | null;
      }>;
    };
  };
  requireClient: () => Promise<{ id: string }>;
}

export async function updateClientProfile(formData: FormData) {
  return _updateClientProfile(formData, { db: prisma as unknown as UpdateClientProfileDeps['db'], requireClient });
}

export async function _updateClientProfile(formData: FormData, deps: UpdateClientProfileDeps) {
  try {
    const user = await deps.requireClient();

    const name = formData.get('fullName') as string;
    const rawPhone = formData.get('phone') as string;
    const rawEmail = formData.get('email') as string | null;

    if (!name || !name.trim() || !rawPhone) {
      return { success: false, error: 'Le nom et le téléphone sont obligatoires.' };
    }

    const phone = rawPhone.trim();
    if (!phone) {
      return { success: false, error: 'Le numéro de téléphone est obligatoire.' };
    }

    let email: string | null = null;
    if (rawEmail && rawEmail.trim() !== '') {
      email = rawEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Le format de l\'adresse email est invalide.', field: 'email' };
      }
    }

    const updatedUser = await deps.db.user.update({
      where: { id: user.id },
      data: {
        fullName: name.trim(),
        phone,
        email
      }
    });

    return {
      success: true,
      message: 'Profil mis à jour avec succès.',
      user: {
        id: updatedUser.id,
        name: updatedUser.fullName,
        phone: updatedUser.phone,
        email: updatedUser.email
      }
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      if (target.includes('email')) {
        return { success: false, error: 'Cette adresse email est déjà utilisée par un autre compte.', field: 'email' };
      }
      if (target.includes('phone')) {
        return { success: false, error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.', field: 'phone' };
      }
      return { success: false, error: 'Ces informations sont déjà utilisées.' };
    }
    console.error("Erreur mise à jour profil client:", error);
    return { success: false, error: 'Une erreur est survenue lors de la mise à jour du profil.' };
  }
}
