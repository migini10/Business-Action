import { matchAnyKeyword, normalizeText } from './fuzzy-match';

export type CustomerIntent = 
  | 'QUOTE_REQUEST'
  | 'FAQ_QUOTE'
  | 'FAQ_SERVICES'
  | 'REQUEST_STATUS'
  | 'HUMAN_SUPPORT'
  | 'UNKNOWN';

export function detectIntent(text: string): CustomerIntent {
  const normalizedText = normalizeText(text);

  const words = normalizedText.split(' ');

  // Quote request: devis, quote, prix, price, combien, naata, cost, tarif
  // Adding explicit start commands to quote request as well
  const quoteKeywords = ['devis', 'quote', 'prix', 'price', 'combien', 'naata', 'cost', 'tarif', 'tarifs', 'commencer', 'start', 'tambali', 'much'];
  
  // Status request: statut, status, suivi, where, quand, etat, track
  const statusKeywords = ['statut', 'status', 'suivi', 'where', 'quand', 'etat', 'track'];

  // Human support: humain, human, conseiller, agent, parler, help, aide, assist, assistance, personne, advisor
  const humanKeywords = ['humain', 'human', 'conseiller', 'agent', 'parler', 'help', 'aide', 'assist', 'assistance', 'personne', 'advisor'];

  // General questions: question, info, comment, how, information, quel, what, ban, naka
  const questionKeywords = ['question', 'info', 'comment', 'how', 'information', 'informations', 'quel', 'quelle', 'what', 'ban', 'naka'];

  // Services: service, services, proposer, faites, vehicule, offer
  const serviceKeywords = ['service', 'services', 'proposer', 'proposez', 'faites', 'vehicule', 'offer', 'do', 'def', 'xetu', 'auto', 'camion', 'moto'];

  let quoteScore = 0;
  let statusScore = 0;
  let humanScore = 0;
  let questionScore = 0;
  let serviceScore = 0;

  for (const word of words) {
    if (matchAnyKeyword(word, quoteKeywords)) quoteScore++;
    if (matchAnyKeyword(word, statusKeywords)) statusScore++;
    if (matchAnyKeyword(word, humanKeywords)) humanScore++;
    if (matchAnyKeyword(word, questionKeywords)) questionScore++;
    if (matchAnyKeyword(word, serviceKeywords)) serviceScore++;
  }

  // Prioritize intents
  if (humanScore > 0 && humanScore >= quoteScore && humanScore >= statusScore && humanScore >= questionScore && humanScore >= serviceScore) return 'HUMAN_SUPPORT';
  if (statusScore > 0 && statusScore >= quoteScore && statusScore >= questionScore && statusScore >= serviceScore) return 'REQUEST_STATUS';

  if (quoteScore > 0) {
    // If the user asks a question about a quote (e.g. "Comment demander un devis ?")
    // we route to FAQ_QUOTE. But if they just say "Je veux un devis", "Commencer", it's QUOTE_REQUEST
    if (questionScore > 0) {
      return 'FAQ_QUOTE';
    }
    return 'QUOTE_REQUEST';
  }

  if (serviceScore > 0) return 'FAQ_SERVICES';

  return 'UNKNOWN';
}
