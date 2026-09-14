import { companyConfig } from '@/lib/company-config';
import { SiteContent } from './types';

export const siteContent: SiteContent = {
  company: {
    commercialName: companyConfig.commercialName,
    legalName: companyConfig.legalName,
    legalForm: 'Entrepreneur individuel',
    ninea: '004931566',
    rccm: 'SN.DKR.2013.A.18600',
    address: companyConfig.address,
    phone: companyConfig.phone,
    whatsappUrl: companyConfig.whatsappUrl,
    whatsappNumber: companyConfig.whatsappNumber,
    privacyEmail: companyConfig.privacyEmail,
    publicUrl: companyConfig.publicUrl,
    publicationDirector: 'NIANE ABDOU BAKHE',
    hostingProviders: ['Vercel', 'DigitalOcean'],
  },
  supportHours: {
    phone: 'Du lundi au samedi',
    digital: '7j/7 en ligne',
  },
  quote: {
    maxFileSizeMB: 4,
    maxFileSizeBytes: 4 * 1024 * 1024,
    requiredDocs: {
      immatricule: 'Carte grise (recto et verso pour véhicule immatriculé)',
      nonImmatricule: 'CMC (Certificat de Mise en Circulation pour véhicule non immatriculé)',
    },
    vehicleCategories: [
      'Véhicule particulier',
      'Véhicule utilitaire',
      'Poids lourd',
      'Deux roues',
    ],
    digitalProcess: '100% digital sans déplacement : analyse rapide et consultation des meilleures compagnies partenaires au Sénégal',
    deliveryChannels: ['WhatsApp', 'Email'],
  },
  tracking: {
    identifier: 'Numéro de dossier (format DOS-XXXX)',
    authRequirement: 'Numéro de dossier et numéro de téléphone associé pour déverrouiller et afficher les documents sécurisés',
    statuses: {
      EN_ATTENTE: 'Dossier reçu, en attente de prise en charge par un agent.',
      EN_TRAITEMENT: 'Dossier en cours d’analyse et de négociation auprès des assureurs partenaires.',
      OFFRE_ENVOYEE: 'Une ou plusieurs propositions de devis ont été transmises au client par WhatsApp ou Email.',
      VALIDE: 'Offre acceptée et validée par le client.',
      REJETE: 'Dossier non validé (document illisible, informations incomplètes ou refus de souscription).',
    },
  },
  account: {
    features: 'Retrouver les devis, gérer son profil, consulter les factures et créances en toute transparence',
    login: 'Numéro de téléphone et mot de passe',
    passwordReset: {
      channels: ['WhatsApp', 'Email'],
      validityMinutes: 15,
      securityNote: 'Code de réinitialisation sécurisé (OTP) valable 15 minutes envoyé exclusivement par WhatsApp ou Email. Aucun envoi par SMS.',
    },
  },
  privacy: {
    law: 'loi sénégalaise n° 2008-12 sur la protection des données à caractère personnel',
    noResale: 'Vos données personnelles et documents de carte grise ne sont jamais revendus ni cédés à des tiers.',
    subcontractors: [
      { name: 'Vercel', role: 'Hébergement web et infrastructure applicative' },
      { name: 'DigitalOcean', role: 'Infrastructure serveur, monitoring et reverse proxy' },
      { name: 'Supabase', role: 'Base de données PostgreSQL et stockage sécurisé des documents' },
      { name: 'Resend', role: 'Envoi des courriers électroniques transactionnels' },
      { name: 'Meta WhatsApp Cloud API', role: 'Échanges et notifications officielles WhatsApp' },
    ],
    retention: {
      quoteDocuments: 'Conservés 12 mois après la clôture du dossier, sauf si un contrat actif, un litige en cours ou une obligation légale nécessite une conservation différente',
      clientAccount: 'Conservé jusqu’à votre demande de suppression ou la fin de notre relation, sous réserve des délais techniques et des obligations légales applicables',
      financialTransactions: 'Conservées ou archivées pendant la durée nécessaire au respect des obligations comptables, fiscales ou légales applicables en vigueur',
    },
  },
  deletion: {
    procedure: 'Conformément à la réglementation sénégalaise, vous bénéficiez d’un droit permanent de suppression de vos données personnelles par demande email à telemultiservices@gmail.com en indiquant le numéro de téléphone associé au compte',
    noInstantButton: 'Il n’existe pas de bouton de suppression automatique instantanée pour des raisons de conformité et sécurité',
    steps: [
      'Demande par email à telemultiservices@gmail.com avec numéro de téléphone',
      'Vérification de l’identité du titulaire légitime du compte',
      'Analyse et effacement des données personnelles dans les systèmes primaires',
      'Archivage légal obligatoire des transactions financières',
      'Message de confirmation au demandeur',
    ],
  },
  terms: {
    role: 'Intermédiaire et apporteur d’affaires en assurance',
    notAnInsurer: 'Business Action n’est pas une compagnie d’assurance et n’émet pas directement les contrats d’assurance',
    pricingAuthority: 'Les tarifs proposés, garanties et acceptations relèvent de la seule compétence des partenaires assureurs',
    userObligations: 'Fournir des informations exactes et des documents authentiques et lisibles sous peine d’annulation du dossier',
  },
};
