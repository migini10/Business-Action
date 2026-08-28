import { SupportedLanguage } from '../language';
import { CustomerIntent } from '../intent';

export function getFaqResponse(language: SupportedLanguage | null, intent: CustomerIntent): string | null {
  const lang = language || 'fr';

  const knowledge = {
    fr: {
      FAQ_SERVICES: "Pour les demandes de devis actuellement prises en charge dans Business Action, vous pouvez sélectionner :\n- Véhicule particulier\n- Utilitaire\n- Poids lourd\n- Deux roues\n\nSi vous souhaitez préciser votre besoin, je peux vous aider à démarrer une demande de devis ou vous orienter vers un conseiller.",
      FAQ_QUOTE: "Je peux vous aider directement à faire une demande de devis.\nÉcrivez « Commencer » pour démarrer, ou « Conseiller » pour parler à quelqu'un.",
      REQUEST_STATUS: "Je ne peux pas vérifier automatiquement le statut de votre dossier pour le moment. Veuillez écrire « Conseiller » et un agent se chargera de vous renseigner.",
      HUMAN_SUPPORT: "Je vous transfère à un conseiller. Il vous répondra dans les plus brefs délais.",
      GREETING: "Bonjour et bienvenue chez Business Action ! Que souhaitez-vous faire ?\n1. Demander un devis\n2. Suivre un dossier\n3. Parler à un conseiller",
      UNKNOWN: "Je n'ai pas suffisamment d'informations pour vous répondre avec certitude.\nVous pouvez reformuler votre question ou écrire « Conseiller » pour parler à quelqu'un.",
    },
    en: {
      FAQ_SERVICES: "For quote requests currently supported in Business Action, you can select:\n- Passenger vehicle\n- Utility vehicle\n- Heavy vehicle\n- Two-wheeler\n\nIf you want to specify your needs, I can help you start a quote request or direct you to an advisor.",
      FAQ_QUOTE: "I can help you directly with a quote request.\nType \"Start\" to begin, or \"Advisor\" to speak with someone.",
      REQUEST_STATUS: "I cannot automatically check the status of your request at this time. Please type \"Advisor\" and an agent will assist you.",
      HUMAN_SUPPORT: "I am transferring you to an agent. They will reply as soon as possible.",
      GREETING: "Hello and welcome to Business Action! How can we help you today?\n1. Request a quote\n2. Track a request\n3. Talk to an advisor",
      UNKNOWN: "I don't have enough information to give you a certain answer.\nYou can rephrase your question or type \"Advisor\" to speak with someone.",
    },
    wo: {
      FAQ_SERVICES: "Ngir devis yi ñuy def ci Business Action, mën nga tann:\n- Auto bopp (Particulier)\n- Auto liggéey (Utilitaire)\n- Camion (Poids lourd)\n- Moto (Deux roues)\n\nSu la neexee ñu tambali sa devis, mbaa nga wax ak sunu agent.",
      FAQ_QUOTE: "Mën naa la jappale nga def sa demande devis.\nBindal « Tambali » ngir ñu door, walla « Conseiller » ngir wax ak nit.",
      REQUEST_STATUS: "Mënuma xool fan la sa mbir tollu léegi léegi. Bindal « Conseiller » ngir wax ak agent mu jappale la ci.",
      HUMAN_SUPPORT: "Maa ngi lay jox kiy jappale la. Dina la wuyu leegi.",
      GREETING: "Salam, dalal jamm ci Business Action! Lu ñu la mën a defal?\n1. Laaj devis\n2. Top sama mbir\n3. Wax ak nit",
      UNKNOWN: "Baal ma, amuma ay xibaar yu doy ngir tontu la ci loolu.\nMën nga bindaat sa laaj bi, walla nga bind « Conseiller » ngir wax ak nit.",
    }
  };

  if (intent === 'QUOTE_REQUEST') {
    return null; // Should not reach here for IDLE quote start, it's handled by workflow
  }

  // Safely return the text for the given intent, if it exists in the dictionary
  const intentKey = intent as keyof typeof knowledge['fr'];
  if (knowledge[lang] && knowledge[lang][intentKey]) {
    return knowledge[lang][intentKey];
  }

  // Fallback to unknown if something is missing
  return knowledge[lang]['UNKNOWN'];
}
