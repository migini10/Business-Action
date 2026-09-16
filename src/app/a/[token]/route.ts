import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashToken } from '@/lib/insurance/attestation-token';
import { getAttestationPdfBuffer } from '@/lib/insurance/attestation-storage';

/**
 * Route publique sécurisée de téléchargement de l'attestation d'assurance en PDF sans connexion.
 *
 * Règles strictes :
 * - Autorisation cryptographique par token opaque uniquement (aucun ID devinable dans l'URL).
 * - Ne loggue JAMAIS le token brut.
 * - Aucune redirection vers une URL publique (le PDF est streamé directement depuis le backend).
 * - N'expose jamais l'URL Supabase ni le chemin storagePath.
 * - Révocation instantanée si révoqué, expiré ou attestation invalide/remplacée.
 * - Incrémente de façon atomique downloadCount et met à jour lastDownloadedAt.
 * - Injecte des headers anti-cache stricts.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // 1. Validation minimale du paramètre token
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 2. Hachage SHA-256 (interdiction absolue de logger le token brut)
  const tokenHash = hashToken(token.trim());

  // 3. Lookup sécurisé par hash
  const tokenRecord = await prisma.attestationAccessToken.findUnique({
    where: { tokenHash },
    include: {
      attestation: {
        include: {
          contract: true,
        },
      },
    },
  });

  if (!tokenRecord) {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  const now = new Date();

  // 4. Vérification si le jeton a été révoqué (uniformisé 404)
  if (tokenRecord.revokedAt !== null) {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 5. Vérification expiration du jeton (uniformisé 404)
  if (now >= tokenRecord.expiresAt) {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 6. Vérification du statut de l'attestation (uniformisé 404)
  if (tokenRecord.attestation.statut !== 'VALIDE') {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 7. Vérification de l'échéance de l'attestation (uniformisé 404)
  if (now >= tokenRecord.attestation.dateExpiration) {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 8. Vérification de la présence du document PDF (uniformisé 404)
  const storagePath = tokenRecord.attestation.pdfStoragePath;
  if (!storagePath || storagePath.trim() === '') {
    return new NextResponse('Document introuvable ou lien invalide.', { status: 404 });
  }

  // 9. Récupération sécurisée du PDF depuis le bucket privé
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await getAttestationPdfBuffer(storagePath);
  } catch (err) {
    console.error('Erreur lors de la lecture du document attestation en stockage prive');
    return new NextResponse('Erreur lors de la récupération du document.', { status: 500 });
  }

  // 10. Mise à jour des statistiques de téléchargement (incrément atomique)
  await prisma.attestationAccessToken
    .update({
      where: { id: tokenRecord.id },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: now,
      },
    })
    .catch((err) => {
      console.error('Erreur non bloquante maj stats telechargement attestation');
    });

  // 11. Construction du nom de fichier propre côté serveur
  const cleanPolice = (tokenRecord.attestation.contract?.numeroPolice || 'Assurance')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFilename = `Attestation_${cleanPolice}.pdf`;

  // 12. Headers de sécurité hermétiques
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
  headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers,
  });
}
