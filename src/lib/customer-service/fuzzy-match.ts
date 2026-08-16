export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[a.length][b.length];
}

const FORBIDDEN_FUZZY_MATCHES: Record<string, string[]> = {
  'agent': ['argent'],
  'quote': ['chat'],
  'devis': ['prix', 'devié']
};

export function isFuzzyMatch(word: string, keyword: string): boolean {
  if (word === keyword) return true;

  // Check forbidden matches to avoid false positives (e.g., argent ≈ agent)
  if (FORBIDDEN_FUZZY_MATCHES[keyword] && FORBIDDEN_FUZZY_MATCHES[keyword].includes(word)) {
    return false;
  }

  const maxLen = Math.max(word.length, keyword.length);
  const distance = damerauLevenshteinDistance(word, keyword);

  // Very short words: exact match only
  if (maxLen <= 3) {
    return distance === 0;
  }
  // Medium words: 1 typo allowed
  else if (maxLen <= 6) {
    return distance <= 1;
  }
  // Long words: 2 typos allowed
  else {
    return distance <= 2;
  }
}

export function matchAnyKeyword(word: string, keywords: string[]): boolean {
  return keywords.some(kw => isFuzzyMatch(word, kw));
}

// Custom normalization preserving some Wolof traits but removing classic accents
export function normalizeText(text: string): string {
  const normalized = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove all diacritics
    .replace(/[^\w\s]/g, ' ') // Punctuation to space
    .replace(/\s+/g, ' ')
    .trim();
    
  return normalized;
}
