'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normalizeTransactionAmount } from '@/lib/finance'

export async function getClientDashboardData(clientId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: clientId }
    });

    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

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
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || !transaction.isModificationPending || !transaction.pendingModification) {
      return { success: false, error: "Aucune modification en attente." };
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
