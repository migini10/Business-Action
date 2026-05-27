'use server'

import prisma from '@/lib/prisma'
import { StatutDossier } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export async function getDossiers() {
  try {
    const dossiers = await prisma.dossier.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, dossiers };
  } catch (error) {
    console.error("Erreur récupération dossiers:", error);
    return { success: false, error: "Erreur lors de la récupération." };
  }
}

export async function updateDossierStatus(id: string, statut: string) {
  try {
    const validStatut = statut as StatutDossier;
    await prisma.dossier.update({
      where: { id },
      data: { statut: validStatut }
    });
    
    // Rafraîchir le cache pour afficher les nouvelles données
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error("Erreur mise à jour statut:", error);
    return { success: false, error: "Impossible de mettre à jour le statut." };
  }
}
