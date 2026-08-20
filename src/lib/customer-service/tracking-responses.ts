import { TypeVehicule } from '@prisma/client';
import { getVehicleTypeName } from './quote-responses';

export const TRACKING_RESPONSES = {
  fr: {
    NOT_FOUND: "Je n'ai trouvé aucun dossier correspondant à votre demande pour ce numéro WhatsApp. Vous pouvez vérifier la référence, démarrer une demande de devis ou écrire « Conseiller ».",
    SINGLE_STATUS: (numero: string, statutText: string, vehicule?: TypeVehicule) =>
      `Votre dossier ${numero}${vehicule ? ` (${getVehicleTypeName(vehicule, 'fr')})` : ''} est actuellement : *${statutText}*.`,
    MULTIPLE_PROMPT: (dossiersList: string) =>
      `J'ai trouvé plusieurs demandes associées à votre numéro :\n\n${dossiersList}\n\nRépondez avec le numéro de la ligne que vous souhaitez consulter (ex: 1), ou écrivez « Annuler ».`,
    INVALID_SELECTION: "Choix invalide. Veuillez répondre avec le numéro de la ligne, ou écrivez « Annuler ».",
    CANCELLED: "Suivi annulé. Comment puis-je vous aider ?",
    HUMAN_TRANSFER: "Je vous transfère à un conseiller. Il vous répondra dans les plus brefs délais."
  },
  en: {
    NOT_FOUND: "I did not find any request matching your inquiry for this WhatsApp number. You can verify the reference, start a quote request, or type \"Advisor\".",
    SINGLE_STATUS: (numero: string, statutText: string, vehicule?: TypeVehicule) =>
      `Your request ${numero}${vehicule ? ` (${getVehicleTypeName(vehicule, 'en')})` : ''} is currently: *${statutText}*.`,
    MULTIPLE_PROMPT: (dossiersList: string) =>
      `I found multiple requests associated with your number:\n\n${dossiersList}\n\nReply with the line number you want to track (e.g. 1), or type "Cancel".`,
    INVALID_SELECTION: "Invalid choice. Please reply with the line number, or type \"Cancel\".",
    CANCELLED: "Tracking cancelled. How can I help you?",
    HUMAN_TRANSFER: "I am transferring you to an agent. They will reply as soon as possible."
  },
  wo: {
    NOT_FOUND: "Gisuma benn dossier bu méngoo ak li nga laaj ci nimero WhatsApp bii. Mën nga xoolaale référence bi, walla nga tambali devis bu bees, mbaa nga bind « Conseiller ».",
    SINGLE_STATUS: (numero: string, statutText: string, vehicule?: TypeVehicule) =>
      `Sa mbir ${numero}${vehicule ? ` (${getVehicleTypeName(vehicule, 'wo')})` : ''} nii la tollu : *${statutText}*.`,
    MULTIPLE_PROMPT: (dossiersList: string) =>
      `Gis naa ay mbir yu bari yu lënku ak sa nimero :\n\n${dossiersList}\n\nBindal nimero bi nga bëgg xool (missaal: 1), walla nga bind « Bayyi » (Annuler).`,
    INVALID_SELECTION: "Tann gi baaxul. Bindal nimero ligne bi, walla nga bind « Bayyi ».",
    CANCELLED: "Bayyi nañu ko. Nuñu la mën a jappalee?",
    HUMAN_TRANSFER: "Maa ngi lay jox kiy jappale la. Dina la wuyu leegi."
  }
};
