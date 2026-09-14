import { SupportedLanguage } from '../language';
import { siteContent } from '@/lib/content';

export type PublicKnowledgeTopic =
  | 'GREETING'
  | 'COMPANY_INFO'
  | 'CONTACT_INFO'
  | 'QUOTE_PROCESS'
  | 'TRACKING_INFO'
  | 'STATUS_EXPLANATION'
  | 'CLIENT_ACCOUNT'
  | 'PASSWORD_RESET'
  | 'LEGAL_PRIVACY'
  | 'DATA_RETENTION'
  | 'DATA_DELETION'
  | 'HOSTING_SUBCONTRACTORS'
  | 'TERMS_LIMITS'
  | 'HOURS_INFO'
  | 'PRIVATE_DATA_REFUSAL'
  | 'SERVICES_OVERVIEW'
  | 'HUMAN_SUPPORT'
  | 'UNKNOWN';

export interface KnowledgeEntry {
  answer: string;
  suggestedAction?: {
    label: string;
    href: string;
    external?: boolean;
  };
}

export function getPublicKnowledge(
  topic: PublicKnowledgeTopic,
  language: SupportedLanguage | null
): KnowledgeEntry {
  const lang = language || 'fr';
  const c = siteContent;

  const entries: Record<SupportedLanguage, Record<PublicKnowledgeTopic, KnowledgeEntry>> = {
    fr: {
      GREETING: {
        answer: `Bonjour et bienvenue sur le service client ${c.company.commercialName} ! Comment puis-je vous aider aujourd'hui ?\nVous pouvez poser vos questions sur nos devis d'assurance auto, le suivi de dossier, nos mentions légales ou contacter directement un conseiller.`,
      },
      COMPANY_INFO: {
        answer: `${c.company.commercialName} est une entreprise individuelle dirigée par ${c.company.publicationDirector} (NINEA: ${c.company.ninea}, RCCM: ${c.company.rccm}).\nAdresse officielle : ${c.company.address}.\nNous agissons comme intermédiaire et apporteur d'affaires pour faciliter vos devis d'assurance auto au Sénégal. L'hébergement technique est assuré par ${c.company.hostingProviders.join(' et ')}.`,
        suggestedAction: {
          label: 'Voir les mentions légales',
          href: '/mentions-legales',
        },
      },
      CONTACT_INFO: {
        answer: `Coordonnées officielles de ${c.company.commercialName} :\n- Téléphone : ${c.company.phone} (${c.supportHours.phone})\n- WhatsApp officiel : ${c.company.whatsappUrl}\n- Email : ${c.company.privacyEmail}\n- Adresse : ${c.company.address}`,
        suggestedAction: {
          label: 'Contacter sur WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      QUOTE_PROCESS: {
        answer: `Pour demander un devis d'assurance automobile :\n1. Rendez-vous sur la page Demander un devis (/demande-devis) sans création préalable de compte obligatoire.\n2. Prenez en photo votre carte grise (recto/verso) ou CMC (Certificat de Mise en Circulation pour véhicule non immatriculé). La taille maximale autorisée est de ${c.quote.maxFileSizeMB} MB par document.\n3. Renseignez votre catégorie (${c.quote.vehicleCategories.join(', ')}).\n4. Vos offres vous sont transmises rapidement par WhatsApp et par Email.`,
        suggestedAction: {
          label: 'Demander un devis en ligne',
          href: '/demande-devis',
        },
      },
      TRACKING_INFO: {
        answer: "Pour protéger votre vie privée et sécuriser vos données personnelles, aucun détail de dossier n'est communiqué dans ce chat public.\nVous pouvez consulter l'état en temps réel de votre demande sur notre page sécurisée Suivi de dossier muni de votre numéro de dossier (ex: DOS-XXXX) et de votre numéro de téléphone pour déverrouiller l'accès aux documents.",
        suggestedAction: {
          label: 'Accéder au Suivi de dossier',
          href: '/suivi',
        },
      },
      STATUS_EXPLANATION: {
        answer: `Voici la signification des statuts de dossier sur Business Action :\n- EN_ATTENTE : ${c.tracking.statuses.EN_ATTENTE}\n- EN_TRAITEMENT : ${c.tracking.statuses.EN_TRAITEMENT}\n- OFFRE_ENVOYEE : ${c.tracking.statuses.OFFRE_ENVOYEE}\n- VALIDE : ${c.tracking.statuses.VALIDE}\n- REJETE : ${c.tracking.statuses.REJETE}`,
        suggestedAction: {
          label: 'Suivre mon dossier',
          href: '/suivi',
        },
      },
      CLIENT_ACCOUNT: {
        answer: `Votre Espace Client vous permet de ${c.account.features}.\nLa connexion s'effectue avec votre numéro de téléphone et votre mot de passe.`,
        suggestedAction: {
          label: 'Accéder à l\'Espace Client',
          href: '/espace-client',
        },
      },
      PASSWORD_RESET: {
        answer: `Pour réinitialiser votre mot de passe, rendez-vous sur la page Mot de passe oublié (/mot-de-passe-oublie).\n${c.account.passwordReset.securityNote}\nLes canaux proposés sont exclusivement ${c.account.passwordReset.channels.join(' et ')}. Aucun code n'est envoyé par SMS.`,
        suggestedAction: {
          label: 'Réinitialiser mon mot de passe',
          href: '/mot-de-passe-oublie',
        },
      },
      LEGAL_PRIVACY: {
        answer: `${c.company.commercialName} respecte rigoureusement la ${c.privacy.law}.\n${c.privacy.noResale}\nVos documents servent exclusivement à l'établissement de vos devis d'assurance.`,
        suggestedAction: {
          label: 'Politique de confidentialité',
          href: '/confidentialite',
        },
      },
      DATA_RETENTION: {
        answer: `Durées de conservation des données sur ${c.company.commercialName} :\n- Documents liés aux devis (cartes grises) : ${c.privacy.retention.quoteDocuments}.\n- Compte client : ${c.privacy.retention.clientAccount}.\n- Transactions et données financières : ${c.privacy.retention.financialTransactions}.`,
        suggestedAction: {
          label: 'Lire la politique de confidentialité',
          href: '/confidentialite',
        },
      },
      DATA_DELETION: {
        answer: `Procédure de suppression de vos données personnelles :\n${c.deletion.procedure}.\n${c.deletion.noInstantButton}.\nÉtapes : ${c.deletion.steps.join(' → ')}.`,
        suggestedAction: {
          label: 'Page de suppression des données',
          href: '/suppression-donnees',
        },
      },
      HOSTING_SUBCONTRACTORS: {
        answer: `Les prestataires techniques et hébergeurs officiels de ${c.company.commercialName} sont :\n${c.privacy.subcontractors.map(s => `- ${s.name} : ${s.role}`).join('\n')}`,
        suggestedAction: {
          label: 'Consulter les mentions légales',
          href: '/mentions-legales',
        },
      },
      TERMS_LIMITS: {
        answer: `Rôle et limites de responsabilité :\n- ${c.terms.notAnInsurer}.\n- ${c.company.commercialName} agit exclusivement comme ${c.terms.role}.\n- ${c.terms.pricingAuthority}.\n- ${c.terms.userObligations}.`,
        suggestedAction: {
          label: 'Lire les conditions générales',
          href: '/conditions-utilisation',
        },
      },
      HOURS_INFO: {
        answer: `Horaires du service client ${c.company.commercialName} :\n- Accueil téléphonique (${c.company.phone}) : ${c.supportHours.phone}.\n- Plateforme web et demandes de devis : ${c.supportHours.digital}.\n- Support WhatsApp : ${c.company.whatsappUrl}`,
        suggestedAction: {
          label: 'Contacter sur WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      PRIVATE_DATA_REFUSAL: {
        answer: "Avis de sécurité : Cet assistant public ne divulgue aucune information confidentielle (mots de passe, dossiers privés, coordonnées bancaires). Pour consulter votre dossier personnel, veuillez utiliser la page sécurisée de suivi ou vous connecter à votre Espace Client.",
        suggestedAction: {
          label: 'Suivi sécurisé',
          href: '/suivi',
        },
      },
      SERVICES_OVERVIEW: {
        answer: `Business Action prend en charge 4 catégories de véhicules pour votre devis d'assurance auto au Sénégal :\n- ${c.quote.vehicleCategories.join('\n- ')}\nLa souscription se fait 100% en ligne sans déplacement. Taille maximale par document : ${c.quote.maxFileSizeMB} MB.`,
        suggestedAction: {
          label: 'Lancer un devis',
          href: '/demande-devis',
        },
      },
      HUMAN_SUPPORT: {
        answer: `Notre équipe de conseillers est à votre écoute pour vous renseigner et traiter vos demandes.\nContactez-nous directement sur WhatsApp (${c.company.phone}) ou par appel téléphonique (${c.supportHours.phone}).`,
        suggestedAction: {
          label: 'Ouvrir WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      UNKNOWN: {
        answer: `Je ne dispose pas de cette information dans la base publique officielle de ${c.company.commercialName}.\nPour une assistance personnalisée, notre équipe est disponible immédiatement sur WhatsApp ou par téléphone au ${c.company.phone}.`,
        suggestedAction: {
          label: 'Parler à un conseiller sur WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
    },
    wo: {
      GREETING: {
        answer: `Salam, dalal jàmm ci service client bu ${c.company.commercialName} ! Lu ñu la mën a jappale tey ?\nMën nga laaj ci devis, fu sa dossier tollu, walla nga waxtaan ak nit.`,
      },
      COMPANY_INFO: {
        answer: `${c.company.commercialName} entreprise bu ${c.company.publicationDirector} la (NINEA: ${c.company.ninea}, RCCM: ${c.company.rccm}).\nFi ñu nekk : ${c.company.address}.\nÑuy jappale ci lépp lu jëm ci assurance auto ak compagnies d'assurance yiy liggéey ci Sénégal. Hébergeurs yi ñooy ${c.company.hostingProviders.join(' ak ')}.`,
        suggestedAction: {
          label: 'Xool Mentions légales',
          href: '/mentions-legales',
        },
      },
      CONTACT_INFO: {
        answer: `Coordonnées bu ${c.company.commercialName} :\n- Telefon : ${c.company.phone} (${c.supportHours.phone})\n- WhatsApp officiel : ${c.company.whatsappUrl}\n- Email : ${c.company.privacyEmail}\n- Fi ñu nekk : ${c.company.address}`,
        suggestedAction: {
          label: 'Waxtaan ci WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      QUOTE_PROCESS: {
        answer: `Ngir laaj sa devis assurance ci ay simili :\n1. Demal ci wàllu Demande devis sans ubbi compte obligatoire.\n2. Nataalal sa carte grise (recto/verso) walla CMC. Fichier bi warul ëpp ${c.quote.maxFileSizeMB} MB.\n3. Tann sa xeetu woto (${c.quote.vehicleCategories.join(', ')}).\n4. Dinañu la yónnee sa devis ci WhatsApp ak Email !`,
        suggestedAction: {
          label: 'Laaj sa devis',
          href: '/demande-devis',
        },
      },
      TRACKING_INFO: {
        answer: "Ngir aar sa xibaari bopp, mënuma génne ay xibaari dossier ci chat bi.\nMën nga xool fu sa dossier tollu ci wàllu Toppatoo ak sa numéro dossier ak sa telefon ngir ubbi say documents.",
        suggestedAction: {
          label: 'Dem ci Toppatoo',
          href: '/suivi',
        },
      },
      STATUS_EXPLANATION: {
        answer: "Li statuts dossier yi di tekki ci Business Action :\n- EN_ATTENTE : Jot nañu dossier bi, amul agent bu ko jël ba tey.\n- EN_TRAITEMENT : Agent yi ñi ngi koy gëstu ak di waxtaan ak compagnies d'assurance yi.\n- OFFRE_ENVOYEE : Yónnee nañu la proposition devis ci WhatsApp mbaa Email.\n- VALIDE : Nangu nga devis bi.\n- REJETE : Dossier bi antuwul (nataal bi leerul walla assurance bi nangwul).",
        suggestedAction: {
          label: 'Toppatoo sa dossier',
          href: '/suivi',
        },
      },
      CLIENT_ACCOUNT: {
        answer: "Sa Espace Client dafay tax nga mën a gis say devis ak say denc.\nDanga koy ubbee ak sa telefon ak sa mot de passe.",
        suggestedAction: {
          label: 'Ubbi sa Espace Client',
          href: '/espace-client',
        },
      },
      PASSWORD_RESET: {
        answer: `Ngir réinitialiser sa mot de passe, demal ci /mot-de-passe-oublie.\nCode bi 15 minutes la koy def te ci WhatsApp walla Email rekk lañu koy yónnee. Duñu yónnee mukk code ci SMS.`,
        suggestedAction: {
          label: 'Defaraat mot de passe',
          href: '/mot-de-passe-oublie',
        },
      },
      LEGAL_PRIVACY: {
        answer: `Business Action dafay wattu bu baax say mbir te du jaay say xibaar mukk (${c.privacy.law}). Li ngay joxe ci sa carte grise dafay nekk rekk ngir def sa devis.`,
        suggestedAction: {
          label: 'Xool Confidentialité',
          href: '/confidentialite',
        },
      },
      DATA_RETENTION: {
        answer: `Fan lañuy dence say xibaar :\n- Nataali carte grise : ${c.privacy.retention.quoteDocuments}.\n- Compte client : ba keroog ngay laaj ñu dindi ko.\n- Données financières : li yoon santee ci wàllu kom-kom ak impôts.`,
        suggestedAction: {
          label: 'Politique de confidentialité',
          href: '/confidentialite',
        },
      },
      DATA_DELETION: {
        answer: `Am nga sañ-sañ ngir dindi say xibaar yépp ci sunu système. Mën nga bind email ci ${c.company.privacyEmail} ak sa numéro telefon. Du dindi wu automatique pour wattu yoon.`,
        suggestedAction: {
          label: 'Dindi say données',
          href: '/suppression-donnees',
        },
      },
      HOSTING_SUBCONTRACTORS: {
        answer: `Prestataires techniques yi ñuy liggéeyal ci ${c.company.commercialName} ñooy Vercel, DigitalOcean, Supabase, Resend ak Meta WhatsApp.`,
        suggestedAction: {
          label: 'Mentions légales',
          href: '/mentions-legales',
        },
      },
      TERMS_LIMITS: {
        answer: `Li ngay xam ci Business Action :\n- Business Action du compagnie d'assurance, intermédiaire la rekk.\n- Assureurs partenaires yi ñooy fijer prix ak garanties yi.\n- Danga wara joxe ay document yu dëggu te leer.`,
        suggestedAction: {
          label: 'Conditions générales',
          href: '/conditions-utilisation',
        },
      },
      HOURS_INFO: {
        answer: `Waktu liggéey bu ${c.company.commercialName} :\n- Telefon (${c.company.phone}) : ${c.supportHours.phone}.\n- Site web ak devis : ${c.supportHours.digital}.\n- WhatsApp : ${c.company.whatsappUrl}`,
        suggestedAction: {
          label: 'WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      PRIVATE_DATA_REFUSAL: {
        answer: "Kàddu gu wér : Bot bi du joxe benn xibaar bu ñuy làq (mot de passe, mbirum keneen). Demal ci Toppatoo walla Espace Client ngir gis say mbir.",
        suggestedAction: {
          label: 'Toppatoo dossier',
          href: '/suivi',
        },
      },
      SERVICES_OVERVIEW: {
        answer: `Business Action dafay def assurance ci 4 xeeti woto ci Sénégal :\n- ${c.quote.vehicleCategories.join('\n- ')}\nLépp ci internet lañu koy defe sans nga déplacer. Fichier bi warul ëpp ${c.quote.maxFileSizeMB} MB.`,
        suggestedAction: {
          label: 'Def demande devis',
          href: '/demande-devis',
        },
      },
      HUMAN_SUPPORT: {
        answer: `Sunu agents ñi ngi fi ngir wuyu la ak jappale la.\nBind nu ci WhatsApp (${c.company.phone}) walla nga wóote ci telefon (${c.supportHours.phone}).`,
        suggestedAction: {
          label: 'Ubbi WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      UNKNOWN: {
        answer: `Amuma lii ci xibaari ${c.company.commercialName} yi ñu wérale.\nSu la neexee, mën nga waxtaan ak sunu conseiller ci WhatsApp (${c.company.whatsappUrl}) walla nga wóote ci ${c.company.phone}.`,
        suggestedAction: {
          label: 'Waxtaan ak conseiller ci WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
    },
    en: {
      GREETING: {
        answer: `Hello and welcome to ${c.company.commercialName} Customer Support! How can I assist you today?\nYou can ask about car insurance quotes, tracking a file, our legal notices, or speak with an advisor.`,
      },
      COMPANY_INFO: {
        answer: `${c.company.commercialName} is a sole proprietorship registered in Senegal, managed by ${c.company.publicationDirector} (NINEA: ${c.company.ninea}, RCCM: ${c.company.rccm}).\nAddress: ${c.company.address}.\nWe act as an insurance intermediary. Technical hosting is handled by ${c.company.hostingProviders.join(' and ')}.`,
        suggestedAction: {
          label: 'View legal notice',
          href: '/mentions-legales',
        },
      },
      CONTACT_INFO: {
        answer: `Official contact details for ${c.company.commercialName}:\n- Phone: ${c.company.phone} (${c.supportHours.phone})\n- Official WhatsApp: ${c.company.whatsappUrl}\n- Email: ${c.company.privacyEmail}\n- Address: ${c.company.address}`,
        suggestedAction: {
          label: 'Contact on WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      QUOTE_PROCESS: {
        answer: `To request an auto insurance quote:\n1. Visit the Quote Request page (/demande-devis) without requiring prior account creation.\n2. Take a photo of your vehicle registration document (carte grise or CMC). Maximum allowed size is ${c.quote.maxFileSizeMB} MB per file.\n3. Select your category (${c.quote.vehicleCategories.join(', ')}).\n4. Receive customized proposals via WhatsApp and Email.`,
        suggestedAction: {
          label: 'Request a quote',
          href: '/demande-devis',
        },
      },
      TRACKING_INFO: {
        answer: "To ensure user privacy and security, specific folder details are never exposed in this public chat.\nYou can view real-time tracking on our secure Tracking page using your dossier code (e.g. DOS-XXXX) and your phone number to unlock documents.",
        suggestedAction: {
          label: 'Open Tracking page',
          href: '/suivi',
        },
      },
      STATUS_EXPLANATION: {
        answer: `Dossier status meanings on Business Action:\n- EN_ATTENTE: ${c.tracking.statuses.EN_ATTENTE}\n- EN_TRAITEMENT: ${c.tracking.statuses.EN_TRAITEMENT}\n- OFFRE_ENVOYEE: ${c.tracking.statuses.OFFRE_ENVOYEE}\n- VALIDE: ${c.tracking.statuses.VALIDE}\n- REJETE: ${c.tracking.statuses.REJETE}`,
        suggestedAction: {
          label: 'Track my dossier',
          href: '/suivi',
        },
      },
      CLIENT_ACCOUNT: {
        answer: `Your Client Portal lets you ${c.account.features}.\nLog in with your phone number and password.`,
        suggestedAction: {
          label: 'Client Portal',
          href: '/espace-client',
        },
      },
      PASSWORD_RESET: {
        answer: `To reset your password, visit the Forgot Password page (/mot-de-passe-oublie).\n${c.account.passwordReset.securityNote}\nAvailable channels are solely ${c.account.passwordReset.channels.join(' and ')}. No codes are sent via SMS.`,
        suggestedAction: {
          label: 'Reset password',
          href: '/mot-de-passe-oublie',
        },
      },
      LEGAL_PRIVACY: {
        answer: `${c.company.commercialName} strictly complies with ${c.privacy.law}.\n${c.privacy.noResale}\nYour documents are solely used to prepare your insurance quote.`,
        suggestedAction: {
          label: 'Privacy Policy',
          href: '/confidentialite',
        },
      },
      DATA_RETENTION: {
        answer: `Data retention periods on ${c.company.commercialName}:\n- Quote documents (carte grise): ${c.privacy.retention.quoteDocuments}.\n- Client account: ${c.privacy.retention.clientAccount}.\n- Financial records: ${c.privacy.retention.financialTransactions}.`,
        suggestedAction: {
          label: 'Read privacy policy',
          href: '/confidentialite',
        },
      },
      DATA_DELETION: {
        answer: `Data deletion procedure:\n${c.deletion.procedure}.\n${c.deletion.noInstantButton}.\nSteps: ${c.deletion.steps.join(' → ')}.`,
        suggestedAction: {
          label: 'Data deletion request',
          href: '/suppression-donnees',
        },
      },
      HOSTING_SUBCONTRACTORS: {
        answer: `Technical hosting and service providers for ${c.company.commercialName}:\n${c.privacy.subcontractors.map(s => `- ${s.name}: ${s.role}`).join('\n')}`,
        suggestedAction: {
          label: 'View legal notice',
          href: '/mentions-legales',
        },
      },
      TERMS_LIMITS: {
        answer: `Terms and liability limits:\n- ${c.terms.notAnInsurer}.\n- ${c.company.commercialName} operates as an ${c.terms.role}.\n- ${c.terms.pricingAuthority}.\n- ${c.terms.userObligations}.`,
        suggestedAction: {
          label: 'Read Terms of Service',
          href: '/conditions-utilisation',
        },
      },
      HOURS_INFO: {
        answer: `Customer service operating hours for ${c.company.commercialName}:\n- Phone lines (${c.company.phone}): ${c.supportHours.phone}.\n- Online web platform: ${c.supportHours.digital}.\n- WhatsApp: ${c.company.whatsappUrl}`,
        suggestedAction: {
          label: 'Contact on WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      PRIVATE_DATA_REFUSAL: {
        answer: "Security notice: This public bot cannot access confidential records (passwords, private dossiers, banking info). Please access your personal details securely through the Tracking page or Client Portal.",
        suggestedAction: {
          label: 'Secure Tracking',
          href: '/suivi',
        },
      },
      SERVICES_OVERVIEW: {
        answer: `Business Action supports 4 vehicle categories for auto insurance in Senegal:\n- ${c.quote.vehicleCategories.join('\n- ')}\n100% online quote. Maximum file size: ${c.quote.maxFileSizeMB} MB.`,
        suggestedAction: {
          label: 'Request quote',
          href: '/demande-devis',
        },
      },
      HUMAN_SUPPORT: {
        answer: `Our support team is ready to assist you directly.\nContact us on WhatsApp (${c.company.phone}) or give us a call (${c.supportHours.phone}).`,
        suggestedAction: {
          label: 'Open WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
      UNKNOWN: {
        answer: `I do not have this information in ${c.company.commercialName}'s official public documentation.\nFor personalized assistance, our team is available on WhatsApp or by phone at ${c.company.phone}.`,
        suggestedAction: {
          label: 'Speak with an advisor on WhatsApp',
          href: c.company.whatsappUrl,
          external: true,
        },
      },
    },
  };

  const selectedLang = entries[lang] ? lang : 'fr';
  const entry = entries[selectedLang][topic];
  return entry || entries[selectedLang]['UNKNOWN'];
}
