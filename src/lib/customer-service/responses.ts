import { SupportedLanguage } from './language';
import { CustomerIntent } from './intent';

export function getAutoResponse(language: SupportedLanguage | null, intent: CustomerIntent): string {
  // Fallback to French if no language is detected
  const lang = language || 'fr';

  const responses = {
    fr: {
      QUOTE_REQUEST: "Bien sûr. Je peux vous aider à préparer votre demande de devis. Quel service recherchez-vous ?",
      GENERAL_QUESTION: "Je suis à votre disposition. Quelle est votre question ?",
      REQUEST_STATUS: "Pour suivre votre demande, veuillez m'indiquer votre numéro de dossier ou patienter, un conseiller va vous répondre.",
      HUMAN_SUPPORT: "Je vous transfère à un conseiller. Il vous répondra dans les plus brefs délais.",
      UNKNOWN: "Désolé, je n'ai pas bien compris. Souhaitez-vous parler à un conseiller ou formuler une demande de devis ?"
    },
    en: {
      QUOTE_REQUEST: "Of course. I can help you prepare your quote request. What service do you need?",
      GENERAL_QUESTION: "I am at your disposal. What is your question?",
      REQUEST_STATUS: "To track your request, please provide your file number or wait for an agent to reply.",
      HUMAN_SUPPORT: "I am transferring you to an agent. They will reply as soon as possible.",
      UNKNOWN: "Sorry, I didn't quite catch that. Would you like to speak to an agent or request a quote?"
    },
    wo: {
      QUOTE_REQUEST: "Waaw, dina la jappale ci sa devis. Ban service nga soxla ?",
      GENERAL_QUESTION: "Maa ngi fi ngir yow. Lan nga bëgg laaj ?",
      REQUEST_STATUS: "Ngir xam fan la sa mbir tollu, jox ma sa numéro dossier walla nga xaar tuuti, amna ku lay wuyu leegi.",
      HUMAN_SUPPORT: "Maa ngi lay jox kiy jappale la. Dina la wuyu leegi.",
      UNKNOWN: "Baal ma, dégguma bu baax. Danga bëgg wax ak ab conseiller walla danga bëgg devis ?"
    }
  };

  return responses[lang][intent];
}
