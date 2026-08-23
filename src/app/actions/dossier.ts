'use server'

import prisma from '@/lib/prisma'
import { TypeVehicule, DossierDocumentType, DossierDocumentSide } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { sendPushNotificationSafe } from '@/lib/push/send-push'
import { checkMagicBytes } from '@/lib/magic-bytes'
import { evaluateDocumentReadability } from '@/lib/google-document-ocr'

export type FormField = 'phone' | 'email' | 'cmc' | 'recto' | 'verso' | 'global';

export type CreateDossierResult =
  | { success: true; numeroDossier: string }
  | { success: false; errors: Partial<Record<FormField, string>> };

let supabaseInstance: any = null;
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseInstance && url && key) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export async function createDossier(formData: FormData): Promise<CreateDossierResult> {
  const phone = formData.get('phone') as string
  const emailRaw = formData.get('email') as string
  const email = emailRaw ? emailRaw : null;
  const typeVehiculeRaw = formData.get('typeVehicule') as string
  const situationVehicule = formData.get('situationVehicule') as string
  const rectoFile = formData.get('recto') as File | null
  const versoFile = formData.get('verso') as File | null
  const cmcFile = formData.get('cmc') as File | null

  let typeVehicule: TypeVehicule = TypeVehicule.PARTICULIER
  if (typeVehiculeRaw === 'utilitaire') typeVehicule = TypeVehicule.UTILITAIRE
  if (typeVehiculeRaw === 'poids-lourd') typeVehicule = TypeVehicule.POIDS_LOURD
  if (typeVehiculeRaw === 'deux-roues') typeVehicule = TypeVehicule.DEUX_ROUES

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, errors: { global: "Configuration Supabase manquante sur le serveur." } };
  }

  // Validations frontend vs serveur
  if (situationVehicule === 'immatricule') {
    if (!rectoFile || !versoFile) return { success: false, errors: { global: "Recto et Verso sont obligatoires pour un véhicule immatriculé." } }
    if (cmcFile) return { success: false, errors: { cmc: "Conflit de fichiers: CMC fourni pour un véhicule immatriculé." } }
  } else if (situationVehicule === 'non_immatricule') {
    if (!cmcFile) return { success: false, errors: { cmc: "Le document CMC est obligatoire." } }
    if (rectoFile || versoFile) return { success: false, errors: { recto: "Conflit de fichiers: Carte Grise fournie pour un véhicule non immatriculé." } }
  } else {
    return { success: false, errors: { global: "Situation du véhicule invalide." } }
  }

  // Génération d'un numéro de dossier unique pour affichage client
  const numeroDossier = 'DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN'

  // Génération d'un UUID opaque pour le stockage
  const uploadUuid = crypto.randomUUID();

  const filesToUpload: { file: File, type: DossierDocumentType, side: DossierDocumentSide, field: FormField }[] = [];
  if (situationVehicule === 'immatricule') {
    filesToUpload.push({ file: rectoFile!, type: DossierDocumentType.CARTE_GRISE, side: DossierDocumentSide.RECTO, field: 'recto' });
    filesToUpload.push({ file: versoFile!, type: DossierDocumentType.CARTE_GRISE, side: DossierDocumentSide.VERSO, field: 'verso' });
  } else {
    filesToUpload.push({ file: cmcFile!, type: DossierDocumentType.CMC, side: DossierDocumentSide.SINGLE, field: 'cmc' });
  }

  const MAX_SIZE = 4 * 1024 * 1024;
  const uploadedPaths: string[] = [];
  const documentData: { type: DossierDocumentType, side: DossierDocumentSide, storagePath: string, enhancedStoragePath?: string | null, mimeType: string, expiresAt: Date }[] = [];

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    for (const item of filesToUpload) {
      if (item.file.size > MAX_SIZE) {
        if (uploadedPaths.length > 0) {
          await getSupabase().storage.from('dossier_documents').remove(uploadedPaths).catch((e: unknown) => console.error("Rollback error:", e));
        }
        return { success: false, errors: { [item.field]: "Le fichier ne doit pas dépasser 4 MB." } };
      }

      const buffer = Buffer.from(await item.file.arrayBuffer());
      const verifiedMime = checkMagicBytes(buffer);
      if (!verifiedMime) {
        if (uploadedPaths.length > 0) {
          await getSupabase().storage.from('dossier_documents').remove(uploadedPaths).catch((e: unknown) => console.error("Rollback error:", e));
        }
        return { success: false, errors: { [item.field]: "Format de fichier non valide ou corrompu." } };
      }

      if (item.type === DossierDocumentType.CARTE_GRISE && verifiedMime === 'application/pdf') {
        if (uploadedPaths.length > 0) {
          await getSupabase().storage.from('dossier_documents').remove(uploadedPaths).catch((e: unknown) => console.error("Rollback error:", e));
        }
        return { success: false, errors: { [item.field]: "Le format PDF est refusé pour la Carte Grise." } };
      }

      const fileUuid = crypto.randomUUID();
      const ext = verifiedMime === 'application/pdf' ? 'pdf' : verifiedMime.split('/')[1];
      const folder = item.type === DossierDocumentType.CMC ? 'cmc' : 'carte-grise';
      const sidePrefix = item.side.toLowerCase();

      if (ext !== 'pdf') {
        const readability = await evaluateDocumentReadability(buffer);
        if (!readability.isReadable) {
          if (uploadedPaths.length > 0) {
            await getSupabase().storage.from('dossier_documents').remove(uploadedPaths).catch((e: unknown) => console.error("Rollback error:", e));
          }
          return { success: false, errors: { [item.field]: "Le document ne contient pas suffisamment de texte lisible." } };
        }
      }

      const storagePath = `${uploadUuid}/${folder}/${sidePrefix}-${fileUuid}.${ext}`;
      const { data, error } = await supabase.storage.from('dossier_documents').upload(storagePath, buffer, { contentType: verifiedMime });
      if (error || !data) throw new Error("Erreur upload original.");
      uploadedPaths.push(storagePath);

      documentData.push({ type: item.type, side: item.side, storagePath, enhancedStoragePath: null, mimeType: verifiedMime, expiresAt });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    const newDossier = await prisma.$transaction(async (tx) => {
      return await tx.dossier.create({
        data: { phone, email, typeVehicule, numeroDossier, clientId: user ? user.id : null, documents: { create: documentData } }
      });
    });

    await sendPushNotificationSafe({ title: 'Nouvelle demande', body: `${newDossier.numeroDossier}`, url: '/admin' });
    return { success: true, numeroDossier: newDossier.numeroDossier };
  } catch (err: any) {
    console.error("Dossier creation error:", err);
    if (uploadedPaths.length > 0) {
      await getSupabase().storage.from('dossier_documents').remove(uploadedPaths).catch((e: unknown) => console.error("Rollback error:", e));
    }
    return { success: false, errors: { global: err.message || "Erreur interne." } };
  }
}
