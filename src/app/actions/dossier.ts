'use server'

import prisma from '@/lib/prisma'
import { TypeVehicule } from '@prisma/client'

export async function createDossier(formData: FormData) {
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const typeVehiculeRaw = formData.get('typeVehicule') as string
  
  let typeVehicule: TypeVehicule = TypeVehicule.PARTICULIER
  if (typeVehiculeRaw === 'utilitaire') typeVehicule = TypeVehicule.UTILITAIRE
  if (typeVehiculeRaw === 'poids-lourd') typeVehicule = TypeVehicule.POIDS_LOURD
  if (typeVehiculeRaw === 'deux-roues') typeVehicule = TypeVehicule.DEUX_ROUES

  // Génération d'un numéro de dossier unique
  const numeroDossier = 'DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN'

  try {
    const newDossier = await prisma.dossier.create({
      data: {
        phone,
        email,
        typeVehicule,
        numeroDossier,
      }
    })
    
    return { success: true, numeroDossier: newDossier.numeroDossier }
  } catch (error) {
    console.error("Erreur lors de la création du dossier:", error)
    return { success: false, error: "Une erreur est survenue lors de l'enregistrement." }
  }
}
