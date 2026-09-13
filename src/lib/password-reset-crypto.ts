import crypto from 'crypto';

// Shared between the reset-password Server Actions and the verify-reset API
// route. Kept in a plain module (no 'use server') because Server Action files
// may only export async functions, and these are synchronous.

// The secret must be present for the reset process to work safely
export const getOtpSecret = (secretOverride?: string) => {
  const secret = secretOverride || process.env.PASSWORD_RESET_OTP_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_OTP_SECRET is missing');
  return secret;
};

// Hashes a string (OTP or Reset Token)
export function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Signed, opaque temporary-session envelope: references a PasswordResetChallenge
// by id only (non-sensitive, never usable without the matching signature) and
// carries its own expiry. Never contains the raw WhatsApp reset-link token.
export interface ResetSessionPayload {
  challengeId: string;
  exp: number; // ms epoch
}

export function signResetSession(payload: ResetSessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyResetSession(cookieValue: string | null | undefined, secret: string): ResetSessionPayload | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expectedSignature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof payload?.challengeId !== 'string' || typeof payload?.exp !== 'number') return null;
    return payload as ResetSessionPayload;
  } catch {
    return null;
  }
}
