export const QUOTE_RESPONSES = {
  fr: {
    SERVICE_PROMPT: "Quel type de véhicule concerne votre demande ?\n\n1. Particulier\n2. Utilitaire\n3. Poids lourd\n4. Deux roues\n5. Parler à un conseiller",
    SERVICE_INVALID: "Veuillez répondre par 1, 2, 3, 4 ou 5.",
    CONFIRM_PROMPT: (service: string) => `Votre demande concerne un véhicule ${service}.\n\nSouhaitez-vous envoyer cette demande ?\n1. Oui\n2. Modifier\n3. Annuler\n4. Parler à un conseiller`,
    CONFIRM_INVALID: "Veuillez répondre par 1, 2, 3 ou 4.",
    CANCELLED: "Votre demande de devis a été annulée. Vous pouvez recommencer à tout moment.",
    SUCCESS: (ref: string) => `Votre demande de devis a bien été enregistrée sous la référence ${ref}. Notre équipe pourra maintenant la traiter.`,
    HUMAN_TRANSFER: "Un conseiller va prendre le relais pour répondre à votre demande. Merci de patienter.",
    ERROR: "Une erreur est survenue lors de l'enregistrement de votre demande. Veuillez réessayer plus tard.",
    CONCURRENT_ERROR: "Votre demande est déjà en cours de traitement."
  },
  en: {
    SERVICE_PROMPT: "What type of vehicle is your request about?\n\n1. Passenger vehicle\n2. Utility vehicle\n3. Heavy vehicle\n4. Two-wheeler\n5. Talk to an advisor",
    SERVICE_INVALID: "Please reply with 1, 2, 3, 4, or 5.",
    CONFIRM_PROMPT: (service: string) => `Your request is for a ${service} vehicle.\n\nWould you like to send this request?\n1. Yes\n2. Modify\n3. Cancel\n4. Talk to an advisor`,
    CONFIRM_INVALID: "Please reply with 1, 2, 3, or 4.",
    CANCELLED: "Your quote request has been cancelled. You can start over at any time.",
    SUCCESS: (ref: string) => `Your quote request has been successfully recorded under the reference ${ref}. Our team will now process it.`,
    HUMAN_TRANSFER: "An agent will take over to answer your request. Please wait.",
    ERROR: "An error occurred while saving your request. Please try again later.",
    CONCURRENT_ERROR: "Your request is already being processed."
  },
  wo: {
    SERVICE_PROMPT: "Ban xetu auto nga am?\n\n1. Auto bopp (Particulier)\n2. Auto liggéey (Utilitaire)\n3. Camion (Poids lourd)\n4. Moto (Deux roues)\n5. Wax ak nit",
    SERVICE_INVALID: "Tontul ak 1, 2, 3, 4 mbaa 5.",
    CONFIRM_PROMPT: (service: string) => `Sa yitte dafa jëm ci auto ${service}.\n\nNdax bëgg nga yónnee mbir mi ?\n1. Waaw\n2. Sopite\n3. Bàyyi\n4. Wax ak nit`,
    CONFIRM_INVALID: "Tontul ak 1, 2, 3 mbaa 4.",
    CANCELLED: "Dañu dindi sa mbir mi. Mën nga ko tambalilwaat sa bu la neexee.",
    SUCCESS: (ref: string) => `Sa mbir mi jàll na ak nimero bi ${ref}. Sunu équipe dina ci liggéey.`,
    HUMAN_TRANSFER: "Nit dina la jëlal sa mbir mi. Xaaral tuuti.",
    ERROR: "Amna lu doxul ci yónnee bi. Jémaatal bu yàggee.",
    CONCURRENT_ERROR: "Ñu ngi liggéey ci sa mbir mi."
  }
};

export const VEHICLE_TYPES_FR: Record<string, string> = {
  'PARTICULIER': 'particulier',
  'UTILITAIRE': 'utilitaire',
  'POIDS_LOURD': 'poids lourd',
  'DEUX_ROUES': 'deux roues'
};

export const VEHICLE_TYPES_EN: Record<string, string> = {
  'PARTICULIER': 'personal',
  'UTILITAIRE': 'commercial',
  'POIDS_LOURD': 'heavy duty',
  'DEUX_ROUES': 'two-wheeler'
};

export const VEHICLE_TYPES_WO: Record<string, string> = {
  'PARTICULIER': 'bopp (particulier)',
  'UTILITAIRE': 'liggéey (utilitaire)',
  'POIDS_LOURD': 'camion (poids lourd)',
  'DEUX_ROUES': 'moto (deux roues)'
};

export function getVehicleTypeName(type: string, lang: 'fr' | 'en' | 'wo'): string {
  if (lang === 'en') return VEHICLE_TYPES_EN[type] || type;
  if (lang === 'wo') return VEHICLE_TYPES_WO[type] || type;
  return VEHICLE_TYPES_FR[type] || type;
}
