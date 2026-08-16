import { StatutDossier } from '@prisma/client';
import { SupportedLanguage } from './language';

export function getTrackingStatusName(statut: StatutDossier, lang: SupportedLanguage | null): string {
  const language = lang || 'fr';
  
  switch (statut) {
    case 'EN_ATTENTE':
      return language === 'wo' ? 'Ci xaar lay nekk' : language === 'en' ? 'Pending' : 'En attente';
    case 'EN_TRAITEMENT':
      return language === 'wo' ? 'Ñu ngi ciy liggéey' : language === 'en' ? 'In progress' : 'En cours de traitement';
    case 'OFFRE_ENVOYEE':
      return language === 'wo' ? 'Yónnee nañu la devis bi' : language === 'en' ? 'Offer sent' : 'Offre envoyée';
    case 'VALIDE':
      return language === 'wo' ? 'Dàcc nañu ko' : language === 'en' ? 'Validated' : 'Validé';
    case 'REJETE':
      return language === 'wo' ? 'Nanguwuñu ko' : language === 'en' ? 'Rejected' : 'Rejeté';
    default:
      return statut;
  }
}
