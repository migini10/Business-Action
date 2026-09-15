import {
  generateAttestationToken,
  GeneratedAttestationToken,
} from './attestation-token';
import {
  computeApplicableReminders,
  filterDuplicateReminders,
  PlannedReminder,
  ReminderStatus,
  ReminderType,
} from './reminder-calculator';

export type ContractSourceMode = 'AUTOMATIQUE' | 'MANUEL';
export type ContractStatus = 'BROUILLON_OCR' | 'VALIDE' | 'RENOUVELE' | 'ANNULE' | 'EXPIRE';
export type AttestationStatus = 'EN_ATTENTE' | 'VALIDE' | 'REMPLACEE' | 'REVOGUEE' | 'ANNULEE';

export interface ContractData {
  id?: string;
  numeroPolice: string;
  compagnie: string;
  assureNom: string;
  immatriculation: string;
  marqueModele?: string | null;
  dateDebut: Date;
  dateExpiration: Date;
  statut: ContractStatus;
  sourceMode: ContractSourceMode;
  clientPhone: string;
  clientEmail?: string | null;
  notes?: string | null;
  userId?: string | null;
  dossierId?: string | null;
  previousContractId?: string | null;
}

export interface AttestationData {
  id?: string;
  contractId?: string;
  numeroAttestation?: string | null;
  pdfStoragePath?: string | null;
  pngStoragePath?: string | null;
  dateDebut: Date;
  dateExpiration: Date;
  statut: AttestationStatus;
  validatedAt?: Date | null;
  validatedBy?: string | null;
}

export interface StoredTokenData {
  id?: string;
  attestationId?: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  downloadCount?: number;
}

export interface ReminderData {
  id?: string;
  contractId?: string;
  type: ReminderType;
  scheduledFor: Date;
  statut: ReminderStatus;
  sentAt?: Date | null;
  error?: string | null;
  waMessageId?: string | null;
}

/**
 * Service pur de logique métier des contrats d'assurance, rappels et attestations.
 */
export class InsuranceContractDomainService {
  /**
   * Crée un contrat et initialise ses rappels d'expiration.
   *
   * RÈGLE CRUCIALE SUR LES JETONS :
   * Ne génère AUCUN jeton de téléchargement à la simple création ou validation du contrat.
   * Un jeton n'est généré QUE si une attestation PDF réellement disponible et validée est fournie.
   */
  static createContract(params: {
    contract: Omit<ContractData, 'statut'> & { statut?: ContractStatus };
    attestation?: AttestationData | null;
    referenceDate?: Date;
  }): {
    contract: ContractData;
    reminders: ReminderData[];
    attestation: AttestationData | null;
    token: { rawToken: string; record: StoredTokenData } | null;
  } {
    const referenceDate = params.referenceDate ?? new Date();

    // Mode automatique sans validation humaine explicite => statut BROUILLON_OCR
    let initialStatus: ContractStatus = params.contract.statut ?? 'VALIDE';
    if (params.contract.sourceMode === 'AUTOMATIQUE' && !params.contract.statut) {
      initialStatus = 'BROUILLON_OCR';
    }

    const contract: ContractData = {
      ...params.contract,
      statut: initialStatus,
    };

    // Calcul des rappels J-7 / J-2 applicables
    // Les rappels sont programmés uniquement si le contrat n'est pas annulé ou brouillon
    const planned = contract.statut === 'VALIDE'
      ? computeApplicableReminders(contract.dateExpiration, referenceDate)
      : [];

    const reminders: ReminderData[] = planned.map((p) => ({
      type: p.type,
      scheduledFor: p.scheduledFor,
      statut: 'PREVU',
    }));

    // Gestion de l'attestation et du jeton
    let attestation: AttestationData | null = null;
    let token: { rawToken: string; record: StoredTokenData } | null = null;

    // RÈGLE : Token généré UNIQUEMENT si une attestation PDF réellement disponible et validée existe
    if (
      params.attestation &&
      params.attestation.pdfStoragePath &&
      params.attestation.pdfStoragePath.trim() !== '' &&
      params.attestation.statut === 'VALIDE'
    ) {
      attestation = { ...params.attestation };
      const generated = generateAttestationToken();
      token = {
        rawToken: generated.rawToken,
        record: {
          tokenHash: generated.tokenHash,
          // RÈGLE : Validité du lien exactement jusqu'à la date d'expiration de l'attestation
          expiresAt: new Date(attestation.dateExpiration.getTime()),
          revokedAt: null,
          downloadCount: 0,
        },
      };
    } else if (params.attestation) {
      // Attestation présente mais sans PDF disponible ou non validée => AUCUN token généré
      attestation = { ...params.attestation };
    }

    return {
      contract,
      reminders,
      attestation,
      token,
    };
  }

  /**
   * Modifie la date d'expiration d'un contrat :
   * - Annule les rappels futurs de l'ancienne échéance (statut = ANNULE).
   * - Recalcule les nouveaux rappels J-7 / J-2 selon la nouvelle date.
   * - Protège contre toute duplication.
   */
  static rescheduleExpiration(params: {
    contract: ContractData;
    newExpirationDate: Date;
    existingReminders: ReminderData[];
    referenceDate?: Date;
  }): {
    updatedContract: ContractData;
    updatedReminders: ReminderData[];
    newReminders: ReminderData[];
  } {
    const referenceDate = params.referenceDate ?? new Date();

    // 1. Annuler les rappels futurs existants à l'état PREVU
    const updatedReminders: ReminderData[] = params.existingReminders.map((reminder) => {
      if (reminder.statut === 'PREVU') {
        return {
          ...reminder,
          statut: 'ANNULE',
        };
      }
      return reminder;
    });

    // 2. Mettre à jour la date d'expiration du contrat
    const updatedContract: ContractData = {
      ...params.contract,
      dateExpiration: params.newExpirationDate,
    };

    // 3. Calculer les nouveaux rappels J-7 et J-2
    const planned = computeApplicableReminders(params.newExpirationDate, referenceDate);

    // 4. Filtrer contre duplication par rapport aux rappels actifs
    const deduplicated = filterDuplicateReminders(planned, updatedReminders);

    const newReminders: ReminderData[] = deduplicated.map((p) => ({
      type: p.type,
      scheduledFor: p.scheduledFor,
      statut: 'PREVU',
    }));

    return {
      updatedContract,
      updatedReminders,
      newReminders,
    };
  }

  /**
   * Clôture l'ancienne période et crée un renouvellement :
   * - Conserve l'historique de l'ancienne période (passe à RENOUVELE).
   * - Annule tous les rappels futurs de l'ancienne période.
   * - Crée un NOUVEAU contrat (avec previousContractId = ancien contrat).
   * - Crée les nouveaux rappels J-7 / J-2 pour la nouvelle période.
   * - Si une nouvelle attestation PDF validée est fournie, génère un nouveau jeton.
   */
  static renewContract(params: {
    oldContract: ContractData;
    oldReminders: ReminderData[];
    newPeriodData: Omit<ContractData, 'id' | 'statut' | 'previousContractId'>;
    newAttestation?: AttestationData | null;
    referenceDate?: Date;
  }): {
    closedOldContract: ContractData;
    closedOldReminders: ReminderData[];
    newContract: ContractData;
    newReminders: ReminderData[];
    newAttestation: AttestationData | null;
    newToken: { rawToken: string; record: StoredTokenData } | null;
  } {
    const referenceDate = params.referenceDate ?? new Date();

    // 1. Clôturer l'ancien contrat
    const closedOldContract: ContractData = {
      ...params.oldContract,
      statut: 'RENOUVELE',
    };

    // 2. Annuler les rappels futurs de l'ancienne période
    const closedOldReminders: ReminderData[] = params.oldReminders.map((r) => {
      if (r.statut === 'PREVU') {
        return { ...r, statut: 'ANNULE' };
      }
      return r;
    });

    // 3. Créer le nouveau contrat lié par previousContractId
    const newContractCreation = this.createContract({
      contract: {
        ...params.newPeriodData,
        statut: 'VALIDE',
        previousContractId: params.oldContract.id ?? null,
      },
      attestation: params.newAttestation,
      referenceDate,
    });

    return {
      closedOldContract,
      closedOldReminders,
      newContract: newContractCreation.contract,
      newReminders: newContractCreation.reminders,
      newAttestation: newContractCreation.attestation,
      newToken: newContractCreation.token,
    };
  }

  /**
   * Révoque un jeton d'accès suite à annulation, révocation ou remplacement.
   */
  static revokeToken(
    tokenRecord: StoredTokenData,
    revocationDate: Date = new Date()
  ): StoredTokenData {
    return {
      ...tokenRecord,
      revokedAt: revocationDate,
    };
  }

  /**
   * Remplacement d'une attestation :
   * - L'ancien jeton est révoqué immédiatement.
   * - L'ancienne attestation passe à REMPLACEE.
   * - La nouvelle attestation est créée.
   * - Un nouveau jeton est généré (valable jusqu'à l'expiration de la nouvelle attestation).
   */
  static replaceAttestation(params: {
    oldAttestation: AttestationData;
    oldTokenRecord?: StoredTokenData | null;
    newAttestation: AttestationData;
    actionDate?: Date;
  }): {
    updatedOldAttestation: AttestationData;
    revokedOldToken: StoredTokenData | null;
    newAttestation: AttestationData;
    newToken: { rawToken: string; record: StoredTokenData } | null;
  } {
    const actionDate = params.actionDate ?? new Date();

    // 1. Ancienne attestation devient REMPLACEE
    const updatedOldAttestation: AttestationData = {
      ...params.oldAttestation,
      statut: 'REMPLACEE',
    };

    // 2. Ancien jeton immédiatement révoqué
    const revokedOldToken: StoredTokenData | null = params.oldTokenRecord
      ? this.revokeToken(params.oldTokenRecord, actionDate)
      : null;

    // 3. Nouvelle attestation validée
    const newAttestation: AttestationData = {
      ...params.newAttestation,
    };

    // 4. Nouveau token si le PDF est disponible et validé
    let newToken: { rawToken: string; record: StoredTokenData } | null = null;
    if (
      newAttestation.pdfStoragePath &&
      newAttestation.pdfStoragePath.trim() !== '' &&
      newAttestation.statut === 'VALIDE'
    ) {
      const generated = generateAttestationToken();
      newToken = {
        rawToken: generated.rawToken,
        record: {
          tokenHash: generated.tokenHash,
          expiresAt: new Date(newAttestation.dateExpiration.getTime()),
          revokedAt: null,
          downloadCount: 0,
        },
      };
    }

    return {
      updatedOldAttestation,
      revokedOldToken,
      newAttestation,
      newToken,
    };
  }
}
