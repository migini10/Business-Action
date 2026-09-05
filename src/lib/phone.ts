import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export function normalizePhoneCanonical(phone: string, defaultCountry: CountryCode = 'SN'): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Clean the string (remove non-digits except +)
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  // Si ça commence par 00, on le remplace par +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Handle local senegalese 9 digits number starting with 0
  if (cleaned.startsWith('0') && cleaned.length === 10 && defaultCountry === 'SN') {
    cleaned = cleaned.substring(1); // remove leading zero
  }

  // Parse phone number
  let phoneNumber;
  if (cleaned.startsWith('+')) {
    phoneNumber = parsePhoneNumberFromString(cleaned);
  } else {
    phoneNumber = parsePhoneNumberFromString(cleaned, defaultCountry);
  }

  if (phoneNumber && phoneNumber.isValid()) {
    return phoneNumber.number as string; // returns strictly E.164 format
  }

  return null;
}
