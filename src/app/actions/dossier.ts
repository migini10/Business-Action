'use server'

import prisma from '@/lib/prisma'
import { TypeVehicule } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function createDossier(formData: FormData) {
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const typeVehiculeRaw = formData.get('typeVehicule') as string
  const rectoFile = formData.get('recto') as File | null
  const versoFile = formData.get('verso') as File | null
  
  let typeVehicule: TypeVehicule = TypeVehicule.PARTICULIER
  if (typeVehiculeRaw === 'utilitaire') typeVehicule = TypeVehicule.UTILITAIRE
  if (typeVehiculeRaw === 'poids-lourd') typeVehicule = TypeVehicule.POIDS_LOURD
  if (typeVehiculeRaw === 'deux-roues') typeVehicule = TypeVehicule.DEUX_ROUES

  // Génération d'un numéro de dossier unique
  const numeroDossier = 'DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN'

  let rectoUrl: string | null = null
  let versoUrl: string | null = null

  if (supabase) {
    if (rectoFile && rectoFile.size > 0) {
      const buffer = Buffer.from(await rectoFile.arrayBuffer());
      const ext = rectoFile.name.split('.').pop() || 'jpg';
      const fileName = `${numeroDossier}_recto_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('cartes_grises').upload(fileName, buffer, {
        contentType: rectoFile.type,
        upsert: true
      });
      if (data && !error) {
        const { data: publicUrlData } = supabase.storage.from('cartes_grises').getPublicUrl(data.path);
        rectoUrl = publicUrlData.publicUrl;
      } else {
        console.error("Erreur upload recto:", error);
        return { success: false, error: "Erreur d'upload de la carte grise (Recto). " + (error?.message || '') };
      }
    }

    if (versoFile && versoFile.size > 0) {
      const buffer = Buffer.from(await versoFile.arrayBuffer());
      const ext = versoFile.name.split('.').pop() || 'jpg';
      const fileName = `${numeroDossier}_verso_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('cartes_grises').upload(fileName, buffer, {
        contentType: versoFile.type,
        upsert: true
      });
      if (data && !error) {
        const { data: publicUrlData } = supabase.storage.from('cartes_grises').getPublicUrl(data.path);
        versoUrl = publicUrlData.publicUrl;
      } else {
        console.error("Erreur upload verso:", error);
        return { success: false, error: "Erreur d'upload de la carte grise (Verso). " + (error?.message || '') };
      }
    }
  } else {
    return { success: false, error: "Configuration Supabase manquante sur le serveur." };
  }

  try {
    const newDossier = await prisma.dossier.create({
      data: {
        phone,
        email,
        typeVehicule,
        numeroDossier,
        rectoUrl,
        versoUrl
      }
    })
    
    return { success: true, numeroDossier: newDossier.numeroDossier }
  } catch (error: any) {
    console.error("Erreur lors de la création du dossier:", error)
    return { success: false, error: "Erreur Serveur: " + (error.message || String(error)) }
  }
}
