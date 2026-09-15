import crypto from 'crypto';

/**
 * Utilitaires cryptographiques pour les jetons d'accès aux attestations d'assurance.
 *
 * Règles de sécurité strictes :
 * - Entropie minimale >= 256 bits (32 octets aléatoires CSPRNG).
 * - Format de transport : base64url (sans caractères réservés d'URL ni padding).
 * - Stockage : UNIQUEMENT sous forme d'empreinte SHA-256 hexadécimale.
 * - Le jeton brut ne doit JAMAIS être persisté en base de données ni loggé.
 */

export interface GeneratedAttestationToken {
  /** Jeton brut envoyé au client dans le lien WhatsApp (jamais persisté). */
  rawToken: string;
  /** Empreinte SHA-256 stockée en base de données. */
  tokenHash: string;
}

export interface TokenValidationResult {
  valid: boolean;
  reason?: 'TOKEN_REVOKED' | 'TOKEN_EXPIRED' | 'ATTESTATION_NOT_VALID' | 'ATTESTATION_EXPIRED' | 'NOT_FOUND';
}

/**
 * Génère un jeton cryptographiquement sécurisé d'au moins 256 bits d'entropie
 * et son empreinte SHA-256 pour stockage en base.
 */
export function generateAttestationToken(): GeneratedAttestationToken {
  // 32 octets = 256 bits d'entropie cryptographique
  const buffer = crypto.randomBytes(32);
  const rawToken = buffer.toString('base64url');
  const tokenHash = hashToken(rawToken);

  return {
    rawToken,
    tokenHash,
  };
}

/**
 * Calcule l'empreinte SHA-256 hexadécimale d'un jeton brut.
 */
export function hashToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Jeton brut invalide ou vide');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Vérifie que le jeton présente au moins 256 bits (32 octets) d'entropie.
 */
export function hasSufficientEntropy(rawToken: string): boolean {
  if (!rawToken || typeof rawToken !== 'string') return false;
  try {
    const buf = Buffer.from(rawToken, 'base64url');
    return buf.length >= 32;
  } catch {
    return false;
  }
}

/**
 * Valide un jeton d'accès selon son enregistrement en base et l'état de l'attestation.
 */
export function validateAttestationAccessToken(
  tokenRecord: {
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  } | null,
  attestationRecord?: {
    statut: string;
    dateExpiration: Date;
  } | null,
  now: Date = new Date()
): TokenValidationResult {
  if (!tokenRecord) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  // 1. Révocation immédiate si révoqué
  if (tokenRecord.revokedAt != null) {
    return { valid: false, reason: 'TOKEN_REVOKED' };
  }

  // 2. Expiration du jeton
  if (now >= tokenRecord.expiresAt) {
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }

  // 3. Vérification de l'attestation associée si fournie
  if (attestationRecord) {
    if (attestationRecord.statut !== 'VALIDE') {
      return { valid: false, reason: 'ATTESTATION_NOT_VALID' };
    }
    if (now >= attestationRecord.dateExpiration) {
      return { valid: false, reason: 'ATTESTATION_EXPIRED' };
    }
  }

  return { valid: true };
}
