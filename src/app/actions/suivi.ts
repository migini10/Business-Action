'use server'

import prisma from '@/lib/prisma'

export async function getDossier(identifier: string, method: 'telephone' | 'dossier') {
  try {
    const dossier = await prisma.dossier.findFirst({
      where: method === 'telephone'
        ? { phone: identifier }
        : { numeroDossier: identifier },
      orderBy: { createdAt: 'desc' } // Retourne le plus récent si recherche par téléphone
    });

    if (!dossier) {
      return { success: false, error: "Aucun dossier trouvé pour cet identifiant." };
    }

    return { success: true, dossier };
  } catch (error) {
    console.error("Erreur lors de la recherche du dossier:", error);
    return { success: false, error: "Une erreur est survenue lors de la recherche." };
  }
}
