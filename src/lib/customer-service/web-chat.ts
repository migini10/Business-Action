import { detectLanguage, SupportedLanguage } from './language';
import { detectIntent } from './intent';
import { matchAnyKeyword, normalizeText } from './fuzzy-match';
import { getPublicKnowledge, PublicKnowledgeTopic } from './knowledge/public-knowledge';

export interface WebChatResult {
  answer: string;
  topic: PublicKnowledgeTopic;
  language: SupportedLanguage;
  suggestedAction?: {
    label: string;
    href: string;
    external?: boolean;
  };
  isFallback: boolean;
}

const PRIVATE_DATA_KEYWORDS = [
  'mot de passe',
  'motdepasse',
  'password',
  'passwords',
  'code secret',
  'secret',
  'carte bancaire',
  'credit card',
  'base de donnees',
  'database',
  'table user',
  'table dossier',
  'select *',
  'compte bancaire',
  'releve bancaire',
  'donnees privees',
  'private data',
];

export function resolveWebChatMessage(
  rawText: string,
  preferredLanguage?: SupportedLanguage | null
): WebChatResult {
  const text = (rawText || '').trim();
  const normalized = normalizeText(text);

  // 1. Language detection with fallback to preferredLanguage, then 'fr'
  const detected = detectLanguage(text);
  const language: SupportedLanguage = detected || preferredLanguage || 'fr';

  // 2. Safe Public Procedure: Password reset assistance (public procedure, no private disclosure)
  const isPasswordResetQuery =
    (normalized.includes('mot de passe') || normalized.includes('password') || normalized.includes('motdepasse')) &&
    (
      normalized.includes('oubli') ||
      normalized.includes('reinitialis') ||
      normalized.includes('recuper') ||
      normalized.includes('perdu') ||
      normalized.includes('reset') ||
      normalized.includes('forgot') ||
      normalized.includes('changer') ||
      normalized.includes('change') ||
      normalized.includes('comment') ||
      normalized.includes('how') ||
      normalized.includes('sms') ||
      normalized.includes('whatsapp') ||
      normalized.includes('email') ||
      normalized.includes('otp') ||
      normalized.includes('code') ||
      normalized.includes('defaraat') ||
      normalized.includes('fate') ||
      normalized.includes('fatte')
    );

  if (isPasswordResetQuery) {
    const entry = getPublicKnowledge('PASSWORD_RESET', language);
    return {
      answer: entry.answer,
      topic: 'PASSWORD_RESET',
      language,
      suggestedAction: entry.suggestedAction,
      isFallback: false,
    };
  }

  // 3. Defensive Security: Check for private data attempts
  for (const keyword of PRIVATE_DATA_KEYWORDS) {
    if (normalized.includes(normalizeText(keyword))) {
      const entry = getPublicKnowledge('PRIVATE_DATA_REFUSAL', language);
      return {
        answer: entry.answer,
        topic: 'PRIVATE_DATA_REFUSAL',
        language,
        suggestedAction: entry.suggestedAction,
        isFallback: false,
      };
    }
  }

  // 4. Topic matching against public knowledge base
  const topic = determinePublicTopic(text, normalized);
  const entry = getPublicKnowledge(topic, language);

  return {
    answer: entry.answer,
    topic,
    language,
    suggestedAction: entry.suggestedAction,
    isFallback: topic === 'UNKNOWN',
  };
}

function determinePublicTopic(rawText: string, normalized: string): PublicKnowledgeTopic {
  const words = normalized.split(/\s+/).filter(Boolean);

  // Greetings: match greeting if the input starts with or is a greeting
  const greetingKeywords = ['bonjour', 'bonsoir', 'salut', 'hello', 'hi', 'salam', 'salaam'];
  if (words.length > 0 && greetingKeywords.includes(words[0])) {
    const politeWords = [
      'comment', 'allez', 'vous', 'ca', 'va', 'bien', 'how', 'are', 'you', 'today',
      'there', 'nuyu', 'wa', 'business', 'action', 'dama', 'begg', 'bëgg', 'dalal', 'jamm', 'jàmm'
    ];
    const otherWords = words.slice(1).filter(w => !politeWords.includes(w));
    if (otherWords.length <= 3) {
      return 'GREETING';
    }
  }
  if (greetingKeywords.includes(normalized)) {
    return 'GREETING';
  }

  // Status explanation (meaning of dossier statuses)
  if (
    normalized.includes('signification des statuts') ||
    normalized.includes('signification statut') ||
    (normalized.includes('que veut dire') && (normalized.includes('statut') || normalized.includes('en_attente') || normalized.includes('en_traitement') || normalized.includes('en traitement') || normalized.includes('offre_envoyee') || normalized.includes('offre envoyee') || normalized.includes('rejete') || normalized.includes('valide'))) ||
    (normalized.includes('que signifie') && (normalized.includes('statut') || normalized.includes('en_attente') || normalized.includes('en attente') || normalized.includes('en traitement') || normalized.includes('en_traitement') || normalized.includes('offre envoyee') || normalized.includes('offre_envoyee') || normalized.includes('rejete') || normalized.includes('valide'))) ||
    normalized.includes('en_attente') ||
    normalized.includes('en_traitement') ||
    normalized.includes('offre_envoyee') ||
    normalized.includes('status meaning') ||
    normalized.includes('teki statut')
  ) {
    return 'STATUS_EXPLANATION';
  }

  // Data retention (12 mois, etc.)
  if (
    normalized.includes('conservation') ||
    normalized.includes('12 mois') ||
    normalized.includes('duree de conservation') ||
    normalized.includes('combien de temps') ||
    normalized.includes('delai de conservation') ||
    normalized.includes('retention') ||
    normalized.includes('keep data') ||
    (normalized.includes('weer') && normalized.includes('denc'))
  ) {
    return 'DATA_RETENTION';
  }

  // Hosting / Subcontractors
  if (
    normalized.includes('heberge') ||
    normalized.includes('hosting') ||
    normalized.includes('sous-traitant') ||
    normalized.includes('prestataire') ||
    normalized.includes('subcontractor') ||
    normalized.includes('vercel') ||
    normalized.includes('digitalocean') ||
    normalized.includes('digital ocean') ||
    normalized.includes('supabase') ||
    normalized.includes('resend')
  ) {
    return 'HOSTING_SUBCONTRACTORS';
  }

  // Working Hours (Du lundi au samedi)
  if (
    normalized.includes('horaire') ||
    normalized.includes('heure d ouverture') ||
    normalized.includes('heures d ouverture') ||
    normalized.includes('quand appeler') ||
    normalized.includes('lundi au samedi') ||
    normalized.includes('jours d ouverture') ||
    normalized.includes('opening hour') ||
    normalized.includes('heures de travail') ||
    normalized.includes('waxtu liggey') ||
    normalized.includes('disponibilite')
  ) {
    return 'HOURS_INFO';
  }

  // Terms and Limits (not direct insurer, role, pricing)
  if (
    normalized.includes('etes vous assureur') ||
    normalized.includes('etes-vous assureur') ||
    normalized.includes('etes vous une compagnie') ||
    normalized.includes('intermediaire') ||
    normalized.includes('courtier') ||
    normalized.includes('qui fixe les prix') ||
    normalized.includes('qui fixe le tarif') ||
    normalized.includes('obligation') ||
    normalized.includes('limite de responsabilite') ||
    normalized.includes('limites de responsabilite') ||
    normalized.includes('conditions d utilisation') ||
    normalized.includes('cgu') ||
    normalized.includes('are you an insurer') ||
    normalized.includes('terms')
  ) {
    return 'TERMS_LIMITS';
  }

  // Data deletion
  if (
    normalized.includes('supprim') ||
    normalized.includes('effacer') ||
    normalized.includes('delete data') ||
    normalized.includes('dindi')
  ) {
    return 'DATA_DELETION';
  }

  // Legal / Privacy / Terms
  if (
    normalized.includes('confidentialite') ||
    normalized.includes('privacy') ||
    normalized.includes('donnees personnelles') ||
    normalized.includes('mentions legales') ||
    normalized.includes('2008-12')
  ) {
    return 'LEGAL_PRIVACY';
  }

  // Company / Legal identity keywords
  const companyKeywords = [
    'ninea', 'rccm', 'fondateur', 'gerant', 'directeur', 'qui etes vous',
    'qui êtes vous', 'qui est business action', 'bene tally', 'legal',
    'societe', 'entreprise', 'who are you', 'company', 'kan la', 'fan la'
  ];
  if (companyKeywords.some(kw => normalized.includes(kw))) {
    return 'COMPANY_INFO';
  }

  // Contact keywords
  const contactKeywords = [
    'telephone', 'numero', 'email', 'mail', 'appeler', 'contact', 'contacter',
    'phone', 'call', 'numéro', 'adresse', 'localisation', 'woote', 'wooté'
  ];
  if (contactKeywords.some(kw => normalized.includes(kw) || matchAnyKeyword(kw, words))) {
    return 'CONTACT_INFO';
  }

  // Human support / WhatsApp
  const humanKeywords = ['humain', 'human', 'conseiller', 'agent', 'parler', 'advisor', 'whatsapp'];
  if (humanKeywords.some(kw => normalized.includes(kw) || matchAnyKeyword(kw, words))) {
    return 'HUMAN_SUPPORT';
  }

  // Tracking dossier keywords
  const trackingKeywords = ['suivi', 'suivre', 'ou en est', 'where is', 'famu tollu', 'fumu tollu', 'status', 'statut', 'mon dossier', 'sama dossier', 'topp', 'toppatoo', 'dossier', 'any news', 'news'];
  if (trackingKeywords.some(kw => normalized.includes(kw))) {
    return 'TRACKING_INFO';
  }

  // Quote process keywords
  const quoteProcessKeywords = [
    'carte grise', 'cmc', 'documents', 'pieces', 'photo', 'comment devis',
    'faire devis', 'demande devis', 'obtenir devis', 'how quote', 'laaj devis',
    '4 mb', '4mb', 'taille max', 'taille de fichier', 'taille limite', 'poids max'
  ];
  if (quoteProcessKeywords.some(kw => normalized.includes(kw))) {
    return 'QUOTE_PROCESS';
  }

  // Services overview / vehicles
  const servicesKeywords = ['vehicule', 'voiture', 'utilitaire', 'camion', 'moto', 'poids lourd', 'deux roues', 'auto bopp'];
  if (servicesKeywords.some(kw => normalized.includes(kw) || matchAnyKeyword(kw, words))) {
    return 'SERVICES_OVERVIEW';
  }

  // Client account keywords
  const accountKeywords = ['espace client', 'mon compte', 'compte client', 'connexion', 'connecter', 'login', 'register', 'inscription'];
  if (accountKeywords.some(kw => normalized.includes(kw))) {
    return 'CLIENT_ACCOUNT';
  }

  // Fallback to customer-service generic intent detection
  const detected = detectIntent(rawText);
  switch (detected) {
    case 'GREETING':
      return 'GREETING';
    case 'QUOTE_REQUEST':
    case 'FAQ_QUOTE':
      return 'QUOTE_PROCESS';
    case 'FAQ_SERVICES':
      return 'SERVICES_OVERVIEW';
    case 'REQUEST_STATUS':
      return 'TRACKING_INFO';
    case 'HUMAN_SUPPORT':
      return 'HUMAN_SUPPORT';
    default:
      return 'UNKNOWN';
  }
}
