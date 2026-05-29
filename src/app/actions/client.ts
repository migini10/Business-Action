'use server'

import prisma from '@/lib/prisma'

export async function getClientDashboardData(clientId: string) {
  try {
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
