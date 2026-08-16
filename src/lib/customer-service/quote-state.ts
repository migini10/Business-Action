export type QuoteState = 'IDLE' | 'QUOTE_VEHICLE' | 'QUOTE_CONFIRM';

export const VEHICLE_OPTIONS = {
  '1': 'PARTICULIER',
  '2': 'UTILITAIRE',
  '3': 'POIDS_LOURD',
  '4': 'DEUX_ROUES',
  '5': 'HUMAN_SUPPORT',
  
  // Accept string matches as well
  'particulier': 'PARTICULIER',
  'utilitaire': 'UTILITAIRE',
  'poids lourd': 'POIDS_LOURD',
  'camion': 'POIDS_LOURD',
  'deux roues': 'DEUX_ROUES',
  'moto': 'DEUX_ROUES',
  
  'personal': 'PARTICULIER',
  'commercial': 'UTILITAIRE',
  'heavy duty': 'POIDS_LOURD',
  'two-wheeler': 'DEUX_ROUES',
  
  'bopp': 'PARTICULIER',
  'liggéey': 'UTILITAIRE',
  'liggeey': 'UTILITAIRE'
};

export const CONFIRM_OPTIONS = {
  // Yes
  '1': 'CONFIRM',
  'oui': 'CONFIRM',
  'yes': 'CONFIRM',
  'waaw': 'CONFIRM',
  
  // Modify
  '2': 'MODIFY',
  'modifier': 'MODIFY',
  'modify': 'MODIFY',
  'sopite': 'MODIFY',
  
  // Cancel
  '3': 'CANCEL',
  'annuler': 'CANCEL',
  'cancel': 'CANCEL',
  'bayyi': 'CANCEL',
  'bàyyi': 'CANCEL',

  // Human Support
  '4': 'HUMAN_SUPPORT'
};

export function parseVehicleSelection(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  if (VEHICLE_OPTIONS[normalized as keyof typeof VEHICLE_OPTIONS]) {
    return VEHICLE_OPTIONS[normalized as keyof typeof VEHICLE_OPTIONS];
  }
  // Try to find if any key is contained in the text (like "1. particulier" -> we just typed "1")
  for (const [key, val] of Object.entries(VEHICLE_OPTIONS)) {
    if (normalized === key) return val;
  }
  return null;
}

export function parseConfirmSelection(text: string): 'CONFIRM' | 'MODIFY' | 'CANCEL' | 'HUMAN_SUPPORT' | null {
  const normalized = text.toLowerCase().trim();
  if (CONFIRM_OPTIONS[normalized as keyof typeof CONFIRM_OPTIONS]) {
    return CONFIRM_OPTIONS[normalized as keyof typeof CONFIRM_OPTIONS] as 'CONFIRM' | 'MODIFY' | 'CANCEL' | 'HUMAN_SUPPORT';
  }
  return null;
}
