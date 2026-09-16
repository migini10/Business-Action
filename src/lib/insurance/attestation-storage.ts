import crypto from 'crypto';
import sharp from 'sharp';
import { checkMagicBytes } from '@/lib/magic-bytes';
import { getSupabase, getDossierDocumentsBucket } from '@/lib/supabase';

/**
 * Service de stockage privé et de validation des attestations d'assurance (PDF et PNG).
 *
 * Règles strictes :
 * - Stockage exclusivement privé dans Supabase Storage (aucun bucket public, aucun getPublicUrl).
 * - Validation stricte des signatures binaires (magic bytes réels).
 * - Chemins générés exclusivement côté serveur (aucun path traversal, aucun nom utilisateur).
 * - Normalisation de l'image en PNG haute qualité via Sharp.
 * - Nettoyage / Rollback automatique en cas d'échec partiel de téléversement.
 */

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Valide qu'un buffer représente un document PDF authentique respectant la taille limite.
 */
export function validatePdfBuffer(buffer: Buffer): void {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer PDF invalide ou vide');
  }
  if (buffer.length > MAX_PDF_SIZE_BYTES) {
    throw new Error(`Le fichier PDF dépasse la taille maximale autorisée de ${MAX_PDF_SIZE_BYTES / (1024 * 1024)} MB`);
  }
  const mime = checkMagicBytes(buffer);
  if (mime !== 'application/pdf') {
    throw new Error('Signature binaire invalide : le fichier doit être un document PDF authentique');
  }
}

/**
 * Valide qu'un buffer représente une image JPEG ou PNG authentique respectant la taille limite.
 */
export function validateImageBuffer(buffer: Buffer): void {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Buffer d'image invalide ou vide");
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`L'image dépasse la taille maximale autorisée de ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB`);
  }
  const mime = checkMagicBytes(buffer);
  if (mime !== 'image/png' && mime !== 'image/jpeg') {
    throw new Error("Format d'image non autorisé : seuls JPEG et PNG sont acceptés pour l'attestation");
  }
}

/**
 * Normalise toute image (JPEG ou PNG) en format PNG standard haute fidélité via Sharp.
 * Supprime les métadonnées superflues pour la confidentialité.
 */
export async function normalizeAttestationImage(buffer: Buffer): Promise<Buffer> {
  validateImageBuffer(buffer);

  // Sharp normalise vers PNG standard
  const normalizedPng = await sharp(buffer)
    .png({
      compressionLevel: 8,
      adaptiveFiltering: true,
    })
    .toBuffer();

  return normalizedPng;
}

/**
 * Génère des chemins de stockage sécurisés côté serveur pour l'attestation.
 * Empêche tout path traversal ou injection de nom de fichier client.
 */
export function generateAttestationStoragePaths(contractId: string): {
  pdfStoragePath: string;
  pngStoragePath: string;
} {
  const safeContractId = (contractId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileUuid = crypto.randomUUID();

  return {
    pdfStoragePath: `attestations/${safeContractId}/${fileUuid}/attestation.pdf`,
    pngStoragePath: `attestations/${safeContractId}/${fileUuid}/attestation.png`,
  };
}

/**
 * Téléverse de manière sécurisée les fichiers de l'attestation dans le stockage privé Supabase.
 * En cas d'échec partiel (ex: PDF réussi mais PNG échoué), un rollback supprime les fichiers créés.
 */
export async function uploadAttestationFiles(params: {
  contractId: string;
  pdfBuffer: Buffer;
  imageBuffer?: Buffer | null;
  supabaseClient?: any;
  bucketName?: string;
}): Promise<{
  pdfStoragePath: string;
  pngStoragePath: string | null;
}> {
  // 1. Validation stricte du PDF
  validatePdfBuffer(params.pdfBuffer);

  // 2. Traitement et normalisation de l'image si fournie
  let normalizedPngBuffer: Buffer | null = null;
  if (params.imageBuffer) {
    normalizedPngBuffer = await normalizeAttestationImage(params.imageBuffer);
  }

  const supabase = params.supabaseClient || getSupabase();
  const bucket = params.bucketName || getDossierDocumentsBucket();

  const { pdfStoragePath, pngStoragePath } = generateAttestationStoragePaths(params.contractId);
  const uploadedPaths: string[] = [];

  try {
    // 3. Upload du PDF dans le bucket privé
    const { error: pdfError } = await supabase.storage
      .from(bucket)
      .upload(pdfStoragePath, params.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (pdfError) {
      throw new Error(`Échec upload PDF Supabase: ${pdfError.message}`);
    }
    uploadedPaths.push(pdfStoragePath);

    // 4. Upload du PNG normalisé si présent
    let finalPngPath: string | null = null;
    if (normalizedPngBuffer) {
      const { error: pngError } = await supabase.storage
        .from(bucket)
        .upload(pngStoragePath, normalizedPngBuffer, {
          contentType: 'image/png',
          upsert: false,
        });

      if (pngError) {
        throw new Error(`Échec upload PNG Supabase: ${pngError.message}`);
      }
      uploadedPaths.push(pngStoragePath);
      finalPngPath = pngStoragePath;
    }

    return {
      pdfStoragePath,
      pngStoragePath: finalPngPath,
    };
  } catch (err) {
    // Rollback immédiat : nettoyage des fichiers téléversés lors de cette tentative
    if (uploadedPaths.length > 0) {
      await supabase.storage
        .from(bucket)
        .remove(uploadedPaths)
        .catch((rollbackErr: unknown) => {
          console.error('Erreur lors du rollback storage attestation:', rollbackErr);
        });
    }
    throw err;
  }
}

/**
 * Télécharge le buffer du document PDF depuis le stockage privé Supabase.
 */
export async function getAttestationPdfBuffer(
  storagePath: string,
  supabaseClient?: any,
  bucketName?: string
): Promise<Buffer> {
  if (!storagePath || typeof storagePath !== 'string' || storagePath.trim() === '') {
    throw new Error('Chemin de stockage manquant ou invalide');
  }

  // Contrôle strict de sécurité sur le chemin
  if (storagePath.includes('..') || storagePath.startsWith('/')) {
    throw new Error('Chemin de stockage non autorisé');
  }

  const supabase = supabaseClient || getSupabase();
  const bucket = bucketName || getDossierDocumentsBucket();

  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    throw new Error(`Document introuvable dans le stockage privé: ${error?.message || 'Données indisponibles'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Supprime des fichiers d'attestation du stockage privé Supabase.
 */
export async function deleteAttestationFiles(
  paths: string[],
  supabaseClient?: any,
  bucketName?: string
): Promise<void> {
  if (!paths || paths.length === 0) return;
  const safePaths = paths.filter(
    (p) => p && typeof p === 'string' && !p.includes('..') && !p.startsWith('/')
  );
  if (safePaths.length === 0) return;

  const supabase = supabaseClient || getSupabase();
  const bucket = bucketName || getDossierDocumentsBucket();

  await supabase.storage.from(bucket).remove(safePaths);
}
