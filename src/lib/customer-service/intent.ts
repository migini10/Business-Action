export type CustomerIntent = 
  | 'QUOTE_REQUEST'
  | 'GENERAL_QUESTION'
  | 'REQUEST_STATUS'
  | 'HUMAN_SUPPORT'
  | 'UNKNOWN';

export function detectIntent(text: string): CustomerIntent {
  const normalizedText = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalizedText.split(' ');

  // Quote request: devis, quote, prix, price, combien, naata, cost, tarif
  const quoteKeywords = ['devis', 'quote', 'prix', 'price', 'combien', 'naata', 'cost', 'tarif', 'tarifs'];
  
  // Status request: statut, status, suivi, where, quand, etat
  const statusKeywords = ['statut', 'status', 'suivi', 'where', 'quand', 'etat'];

  // Human support: humain, human, conseiller, agent, parler, help, aide, assist, assistance
  const humanKeywords = ['humain', 'human', 'conseiller', 'agent', 'parler', 'help', 'aide', 'assist', 'assistance', 'personne'];

  // General questions: question, info, comment, how, information
  const questionKeywords = ['question', 'info', 'comment', 'how', 'information', 'informations'];

  let quoteScore = 0;
  let statusScore = 0;
  let humanScore = 0;
  let questionScore = 0;

  for (const word of words) {
    if (quoteKeywords.includes(word)) quoteScore++;
    if (statusKeywords.includes(word)) statusScore++;
    if (humanKeywords.includes(word)) humanScore++;
    if (questionKeywords.includes(word)) questionScore++;
  }

  // Prioritize intents
  if (humanScore > 0 && humanScore >= quoteScore && humanScore >= statusScore && humanScore >= questionScore) return 'HUMAN_SUPPORT';
  if (statusScore > 0 && statusScore >= quoteScore && statusScore >= questionScore) return 'REQUEST_STATUS';
  if (quoteScore > 0 && quoteScore >= questionScore) return 'QUOTE_REQUEST';
  if (questionScore > 0) return 'GENERAL_QUESTION';

  return 'UNKNOWN';
}
