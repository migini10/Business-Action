export type SupportedLanguage = 'fr' | 'wo' | 'en';

export function detectLanguage(text: string): SupportedLanguage | null {
  const normalizedText = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = normalizedText.split(' ');

  // Discriminant keywords for each language
  const wolofKeywords = ['begg', 'naata', 'nata', 'naka', 'soxla', 'dama', 'nga', 'waaw', 'waw', 'nuyu', 'jerejef', 'ndax', 'amna', 'amnga'];
  const englishKeywords = ['hello', 'hi', 'quote', 'price', 'cost', 'how', 'much', 'thanks', 'thank', 'yes', 'no', 'please', 'need', 'want'];
  const frenchKeywords = ['bonjour', 'salut', 'devis', 'prix', 'combien', 'merci', 'oui', 'non', 'svp', 'plait', 'besoin', 'veux', 'voudrais', 'tarif'];

  // Exact switch
  if (normalizedText === 'francais' || normalizedText === 'french') return 'fr';
  if (normalizedText === 'wolof') return 'wo';
  if (normalizedText === 'anglais' || normalizedText === 'english') return 'en';

  let woScore = 0;
  let enScore = 0;
  let frScore = 0;

  for (const word of words) {
    if (wolofKeywords.includes(word)) woScore++;
    if (englishKeywords.includes(word)) enScore++;
    if (frenchKeywords.includes(word)) frScore++;
  }

  // Wolof has high priority if any distinct keyword is found
  if (woScore > 0 && woScore >= enScore && woScore >= frScore) return 'wo';
  if (enScore > 0 && enScore > frScore && enScore > woScore) return 'en';
  if (frScore > 0 && frScore >= enScore && frScore >= woScore) return 'fr';

  return null;
}
