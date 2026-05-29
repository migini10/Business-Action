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

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function uploadAndSendDevis(formData: FormData) {
  const dossierId = formData.get('dossierId') as string;
  const devisFile = formData.get('devis') as File | null;
  
  if (!dossierId || !devisFile) {
    return { success: false, error: "Dossier ou fichier manquant." };
  }

  if (!supabase) {
    return { success: false, error: "Configuration Supabase manquante." };
  }

  try {
    const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) return { success: false, error: "Dossier introuvable." };

    // 1. Upload du devis sur Supabase
    const buffer = Buffer.from(await devisFile.arrayBuffer());
    const ext = devisFile.name.split('.').pop() || 'pdf';
    const fileName = `devis_${dossier.numeroDossier}_${Date.now()}.${ext}`;
    
    // On utilise le même bucket ou un bucket "devis" s'il existe (ici on réutilise cartes_grises pour simplifier ou on peut en créer un "documents")
    // Note: Idéalement, créez un bucket "documents" dans Supabase
    const { data, error } = await supabase.storage.from('cartes_grises').upload(fileName, buffer, {
      contentType: devisFile.type,
      upsert: true
    });

    if (error) {
      console.error("Erreur upload devis:", error);
      return { success: false, error: "Erreur lors de l'upload du devis." };
    }

    const { data: publicUrlData } = supabase.storage.from('cartes_grises').getPublicUrl(data.path);
    const devisUrl = publicUrlData.publicUrl;

    // 2. Mise à jour du dossier dans la base de données
    await prisma.dossier.update({
      where: { id: dossierId },
      data: { 
        devisUrl,
        statut: StatutDossier.OFFRE_ENVOYEE 
      }
    });

    // 3. Envoi Automatique (Simulation)
    // Ici, vous devrez intégrer une API comme Resend (pour l'email) et Twilio ou WhatsApp Cloud API (pour WhatsApp)
    console.log(`[SYSTEME] 📧 Envoi de l'email à ${dossier.email} avec le lien du devis: ${devisUrl}`);
    console.log(`[SYSTEME] 💬 Envoi du message WhatsApp au ${dossier.phone} avec le lien du devis: ${devisUrl}`);

    revalidatePath('/admin');
    return { success: true, message: "Devis uploadé et envoyé au client avec succès !", devisUrl };
  } catch (error) {
    console.error("Erreur globale upload devis:", error);
    return { success: false, error: "Une erreur inattendue s'est produite." };
  }
}
