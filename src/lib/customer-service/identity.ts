/**
 * Centralize WhatsApp identity resolution for Business Action.
 * 
 * The `waId` provided by Meta represents the phone number without a plus sign (e.g. "221770000001").
 * The `Dossier` model stores the phone with a plus sign (e.g. "+221770000001").
 */
export function normalizeWhatsAppIdentity(waId: string): string {
  if (!waId) return waId;
  return waId.startsWith('+') ? waId : '+' + waId;
}
