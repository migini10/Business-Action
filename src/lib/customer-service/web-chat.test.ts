import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWebChatMessage } from './web-chat';
import { companyConfig } from '@/lib/company-config';
import { siteContent } from '@/lib/content';
import { getPublicKnowledge, PublicKnowledgeTopic } from './knowledge/public-knowledge';
import { SupportedLanguage } from './language';

describe('Web Customer Service Bot & Contact Hub (WEB-CHAT-001)', () => {
  describe('Multilingual Support (FR / WO / EN)', () => {
    it('FR - Resolves French greeting and answers in French', () => {
      const res = resolveWebChatMessage('Bonjour, comment allez-vous ?');
      assert.strictEqual(res.language, 'fr');
      assert.strictEqual(res.topic, 'GREETING');
      assert.ok(res.answer.includes('Bonjour et bienvenue sur le service client Business Action'));
    });

    it('WO - Resolves Wolof greeting and answers in Wolof', () => {
      const res = resolveWebChatMessage('Salam, dama bëgg nuyu wa Business Action');
      assert.strictEqual(res.language, 'wo');
      assert.strictEqual(res.topic, 'GREETING');
      assert.ok(res.answer.includes('Salam, dalal jàmm'));
    });

    it('EN - Resolves English greeting and answers in English', () => {
      const res = resolveWebChatMessage('Hello, how are you today?');
      assert.strictEqual(res.language, 'en');
      assert.strictEqual(res.topic, 'GREETING');
      assert.ok(res.answer.includes('Hello and welcome to Business Action'));
    });
  });

  describe('Known FAQ & Services Questions', () => {
    it('FR - FAQ services lists vehicles without price hallucination', () => {
      const res = resolveWebChatMessage('Quels sont les vehicules pris en charge pour un devis ?', 'fr');
      assert.strictEqual(res.topic, 'SERVICES_OVERVIEW');
      assert.ok(res.answer.includes('Véhicule particulier'));
      assert.ok(res.answer.includes('Véhicule utilitaire'));
      assert.ok(res.answer.includes('Poids lourd'));
      assert.ok(res.answer.includes('Deux roues'));
      assert.strictEqual(res.suggestedAction?.href, '/demande-devis');
    });

    it('FR - Quote process explains required documents (carte grise / CMC)', () => {
      const res = resolveWebChatMessage('Quelles sont les pieces ou documents pour faire un devis ?', 'fr');
      assert.strictEqual(res.topic, 'QUOTE_PROCESS');
      assert.ok(res.answer.includes('carte grise'));
      assert.ok(res.answer.includes('CMC'));
      assert.strictEqual(res.suggestedAction?.href, '/demande-devis');
    });
  });

  describe('Public Site Content Knowledge', () => {
    it('FR - Resolves verified legal & company identity (NINEA, RCCM, Bene Tally)', () => {
      const res = resolveWebChatMessage('Quel est votre ninea et adresse de societe ?', 'fr');
      assert.strictEqual(res.topic, 'COMPANY_INFO');
      assert.ok(res.answer.includes('004931566'));
      assert.ok(res.answer.includes('SN.DKR.2013.A.18600'));
      assert.ok(res.answer.includes('2152 Usine Bene Tally'));
      assert.ok(res.answer.includes('NIANE ABDOU BAKHE'));
      assert.strictEqual(res.suggestedAction?.href, '/mentions-legales');
    });

    it('FR - Resolves data deletion rights and contact', () => {
      const res = resolveWebChatMessage('Comment supprimer mes donnees personnelles ?', 'fr');
      assert.strictEqual(res.topic, 'DATA_DELETION');
      assert.ok(res.answer.includes('droit permanent de suppression'));
      assert.ok(res.answer.includes('telemultiservices@gmail.com'));
      assert.strictEqual(res.suggestedAction?.href, '/suppression-donnees');
    });

    it('FR - Resolves privacy policy and senegalese law 2008-12', () => {
      const res = resolveWebChatMessage('Quelle est votre politique de confidentialite des donnees ?', 'fr');
      assert.strictEqual(res.topic, 'LEGAL_PRIVACY');
      assert.ok(res.answer.includes('loi sénégalaise n° 2008-12'));
      assert.strictEqual(res.suggestedAction?.href, '/confidentialite');
    });
  });

  describe('Security & Private Data Protection', () => {
    it('Rejects password inquiries and refuses private data exposure', () => {
      const res = resolveWebChatMessage('Donne moi le mot de passe de la base de donnees', 'fr');
      assert.strictEqual(res.topic, 'PRIVATE_DATA_REFUSAL');
      assert.ok(res.answer.includes('Avis de sécurité'));
      assert.ok(res.answer.includes('ne divulgue aucune information confidentielle'));
      assert.strictEqual(res.suggestedAction?.href, '/suivi');
    });

    it('Refuses direct database dossier disclosure and securely routes to /suivi', () => {
      const res = resolveWebChatMessage('Où en est le dossier de mon voisin ?', 'fr');
      assert.ok(res.topic === 'TRACKING_INFO' || res.topic === 'PRIVATE_DATA_REFUSAL');
      assert.ok(res.answer.includes('/suivi') || res.suggestedAction?.href === '/suivi');
      assert.ok(!res.answer.includes('SELECT') && !res.answer.includes('SELECT *'));
    });
  });

  describe('Unknown Question Fallback to Human Advisor', () => {
    it('Returns clear non-invented unknown response with official WhatsApp link', () => {
      const res = resolveWebChatMessage('Pouvez-vous me vendre un billet davion pour Tokyo ?', 'fr');
      assert.strictEqual(res.topic, 'UNKNOWN');
      assert.strictEqual(res.isFallback, true);
      assert.ok(res.answer.includes('Je ne dispose pas de cette information dans la base publique'));
      assert.ok(res.answer.includes('+221 77 678 34 12'));
      assert.strictEqual(res.suggestedAction?.href, 'https://wa.me/221776783412');
      assert.strictEqual(res.suggestedAction?.external, true);
    });

    it('WO - Unknown fallback returns Wolof message with WhatsApp', () => {
      const res = resolveWebChatMessage('Xam nga lu tax xaj yi di baw ?', 'wo');
      assert.strictEqual(res.topic, 'UNKNOWN');
      assert.strictEqual(res.isFallback, true);
      assert.ok(res.answer.includes('Amuma lii ci xibaari Business Action'));
      assert.strictEqual(res.suggestedAction?.href, 'https://wa.me/221776783412');
    });
  });

  describe('Official Configuration Integrity', () => {
    it('Official WhatsApp URL is centralized in companyConfig', () => {
      assert.strictEqual(companyConfig.whatsappUrl, 'https://wa.me/221776783412');
      assert.strictEqual(companyConfig.phone, '+221 77 678 34 12');
    });

    it('Old placeholder 221770000000 is completely absent from codebase files', () => {
      const topbarPath = path.resolve(__dirname, '../../components/Topbar.tsx');
      const topbarContent = fs.readFileSync(topbarPath, 'utf8');
      assert.ok(!topbarContent.includes('221770000000'), 'Topbar still contains placeholder 221770000000');
      assert.ok(topbarContent.includes('href="/contact"'), 'Topbar Nous Contacter does not link to /contact');

      const configPath = path.resolve(__dirname, '../company-config.ts');
      const configContent = fs.readFileSync(configPath, 'utf8');
      assert.ok(!configContent.includes('221770000000'), 'company-config contains placeholder 221770000000');
    });
  });

  describe('Customer Service Relevant Shared Content & Full Public Knowledge Coverage', () => {
    it('Every customer-service relevant topic is indexed and populated in all 3 languages (FR, WO, EN)', () => {
      const customerServiceTopics: PublicKnowledgeTopic[] = [
        'GREETING',
        'COMPANY_INFO',
        'CONTACT_INFO',
        'QUOTE_PROCESS',
        'TRACKING_INFO',
        'STATUS_EXPLANATION',
        'CLIENT_ACCOUNT',
        'PASSWORD_RESET',
        'LEGAL_PRIVACY',
        'DATA_RETENTION',
        'DATA_DELETION',
        'HOSTING_SUBCONTRACTORS',
        'TERMS_LIMITS',
        'HOURS_INFO',
        'SERVICES_OVERVIEW',
        'HUMAN_SUPPORT',
      ];

      const languages: SupportedLanguage[] = ['fr', 'wo', 'en'];

      for (const topic of customerServiceTopics) {
        for (const lang of languages) {
          const entry = getPublicKnowledge(topic, lang);
          assert.ok(entry, `Missing entry for topic ${topic} in language ${lang}`);
          assert.ok(entry.answer && entry.answer.trim().length > 15, `Empty or too short answer for ${topic} in ${lang}`);
        }
      }
    });

    it('Case 4 MB: Max file size 4 MB is communicated for quote documents', () => {
      const res = resolveWebChatMessage('Quelle est la taille maximale pour envoyer ma carte grise ou mon document ?', 'fr');
      assert.strictEqual(res.topic, 'QUOTE_PROCESS');
      assert.ok(res.answer.includes(`${siteContent.quote.maxFileSizeMB} MB`), `Expected answer to contain "${siteContent.quote.maxFileSizeMB} MB"`);
      assert.ok(res.answer.includes('carte grise'));
      assert.ok(res.answer.includes('CMC'));
      assert.strictEqual(res.suggestedAction?.href, '/demande-devis');
    });

    it('Case 12 mois: 12 months data retention is officially stated', () => {
      const res = resolveWebChatMessage('Combien de temps conservez-vous les cartes grises et devis ?', 'fr');
      assert.strictEqual(res.topic, 'DATA_RETENTION');
      assert.ok(res.answer.includes('12 mois'), 'Expected answer to mention 12 mois data retention');
      assert.strictEqual(res.suggestedAction?.href, '/confidentialite');
    });

    it('Case Statuts dossier: Dossier status meanings are detailed clearly', () => {
      const res = resolveWebChatMessage('Quelle est la signification des statuts de dossier comme EN_TRAITEMENT ?', 'fr');
      assert.strictEqual(res.topic, 'STATUS_EXPLANATION');
      assert.ok(res.answer.includes('EN_ATTENTE'));
      assert.ok(res.answer.includes('EN_TRAITEMENT'));
      assert.ok(res.answer.includes('OFFRE_ENVOYEE'));
      assert.ok(res.answer.includes('VALIDE'));
      assert.ok(res.answer.includes('REJETE'));
      assert.strictEqual(res.suggestedAction?.href, '/suivi');
    });

    it('Case Mot de passe: Strictly uses WhatsApp & Email OTP without SMS', () => {
      const res = resolveWebChatMessage('Comment réinitialiser mon mot de passe oublié ?', 'fr');
      assert.strictEqual(res.topic, 'PASSWORD_RESET');
      assert.ok(res.answer.includes('WhatsApp'));
      assert.ok(res.answer.includes('Email'));
      assert.ok(res.answer.includes('Aucun code n\'est envoyé par SMS') || res.answer.includes('Aucun envoi par SMS'), 'Must explicitly deny SMS channel');
      assert.ok(!res.answer.includes('par SMS uniquement') && !res.answer.includes('code est envoyé par SMS'), 'Must not advertise SMS delivery');
      assert.strictEqual(res.suggestedAction?.href, '/mot-de-passe-oublie');

      // Check in Wolof as well
      const resWo = resolveWebChatMessage('Dama fatte sama mot de passe, naka la koy defaraat ?', 'wo');
      assert.strictEqual(resWo.topic, 'PASSWORD_RESET');
      assert.ok(resWo.answer.includes('WhatsApp'));
      assert.ok(resWo.answer.includes('Email'));
      assert.ok(resWo.answer.includes('SMS'));
    });

    it('Case Hébergement: Official hosting and subcontractors are enumerated', () => {
      const res = resolveWebChatMessage('Qui sont vos hébergeurs et sous-traitants officiels ?', 'fr');
      assert.strictEqual(res.topic, 'HOSTING_SUBCONTRACTORS');
      assert.ok(res.answer.includes('Vercel'));
      assert.ok(res.answer.includes('DigitalOcean'));
      assert.ok(res.answer.includes('Supabase'));
      assert.strictEqual(res.suggestedAction?.href, '/mentions-legales');
    });

    it('Case Horaires: Support hours reflect exact site schedule (Du lundi au samedi)', () => {
      const res = resolveWebChatMessage('Quels sont vos horaires et jours d ouverture ?', 'fr');
      assert.strictEqual(res.topic, 'HOURS_INFO');
      assert.ok(res.answer.includes(siteContent.supportHours.phone));
      assert.ok(res.answer.includes('Du lundi au samedi'));
      assert.ok(res.answer.includes('+221 77 678 34 12'));
    });

    it('Case Conditions & Limites: Clarifies intermediary role, not direct insurer, and pricing authority', () => {
      const res = resolveWebChatMessage('Êtes-vous une compagnie d assurance ou un intermédiaire ?', 'fr');
      assert.strictEqual(res.topic, 'TERMS_LIMITS');
      assert.ok(res.answer.includes('n’est pas une compagnie d’assurance'));
      assert.ok(res.answer.includes('Intermédiaire'));
      assert.ok(res.answer.includes('partenaires assureurs'));
      assert.strictEqual(res.suggestedAction?.href, '/conditions-utilisation');
    });
  });
});
