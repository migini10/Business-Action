export interface SubcontractorInfo {
  name: string;
  role: string;
}

export interface DossierStatusInfo {
  code: string;
  label: string;
  description: string;
}

export interface SiteContent {
  company: {
    commercialName: string;
    legalName: string;
    legalForm: string;
    ninea: string;
    rccm: string;
    address: string;
    phone: string;
    whatsappUrl: string;
    whatsappNumber: string;
    privacyEmail: string;
    publicUrl: string;
    publicationDirector: string;
    hostingProviders: string[];
  };
  supportHours: {
    phone: string;
    digital: string;
  };
  quote: {
    maxFileSizeMB: number;
    maxFileSizeBytes: number;
    requiredDocs: {
      immatricule: string;
      nonImmatricule: string;
    };
    vehicleCategories: string[];
    digitalProcess: string;
    deliveryChannels: string[];
  };
  tracking: {
    identifier: string;
    authRequirement: string;
    statuses: Record<string, string>;
  };
  account: {
    features: string;
    login: string;
    passwordReset: {
      channels: string[];
      validityMinutes: number;
      securityNote: string;
    };
  };
  privacy: {
    law: string;
    noResale: string;
    subcontractors: SubcontractorInfo[];
    retention: {
      quoteDocuments: string;
      clientAccount: string;
      financialTransactions: string;
    };
  };
  deletion: {
    procedure: string;
    noInstantButton: string;
    steps: string[];
  };
  terms: {
    role: string;
    notAnInsurer: string;
    pricingAuthority: string;
    userObligations: string;
  };
}
