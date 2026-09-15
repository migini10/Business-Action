import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  generateAttestationToken,
  hashToken,
  hasSufficientEntropy,
  validateAttestationAccessToken,
} from './attestation-token';
import {
  calculateReminderTargetDate,
  computeApplicableReminders,
  filterDuplicateReminders,
  BUSINESS_TIMEZONE,
  REMINDER_HOUR_DAKAR,
} from './reminder-calculator';
import {
  InsuranceContractDomainService,
  ContractData,
  AttestationData,
  ReminderData,
} from './contract-service';

describe('Insurance Reminders & Secure Attestation Tokens - Phase 1', () => {
  describe('1. Moteur pur de rappels (J-7 et J-2)', () => {
    it('expiration normale => planifie J-7 et J-2 à 08:00 Dakar (UTC)', () => {
      // Expiration le 15 octobre 2026
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      // Création le 1er octobre 2026 (J-14, bien avant J-7)
      const referenceDate = new Date(Date.UTC(2026, 9, 1, 10, 0, 0));

      const reminders = computeApplicableReminders(dateExpiration, referenceDate);

      assert.strictEqual(reminders.length, 2, 'Doit planifier exactement deux rappels');
      assert.strictEqual(reminders[0].type, 'J_MINUS_7');
      assert.strictEqual(reminders[1].type, 'J_MINUS_2');

      // J-7 : 8 octobre 2026 à 08:00 UTC (heure de Dakar)
      const expectedJ7 = new Date(Date.UTC(2026, 9, 8, 8, 0, 0));
      assert.strictEqual(
        reminders[0].scheduledFor.toISOString(),
        expectedJ7.toISOString(),
        'La date cible J-7 doit être le 08/10/2026 à 08:00 Dakar'
      );

      // J-2 : 13 octobre 2026 à 08:00 UTC (heure de Dakar)
      const expectedJ2 = new Date(Date.UTC(2026, 9, 13, 8, 0, 0));
      assert.strictEqual(
        reminders[1].scheduledFor.toISOString(),
        expectedJ2.toISOString(),
        'La date cible J-2 doit être le 13/10/2026 à 08:00 Dakar'
      );
    });

    it('création à J-5 => planifie J-2 uniquement', () => {
      // Expiration le 15 octobre 2026
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      // Création le 10 octobre 2026 (J-5, après J-7 du 08/10 mais avant J-2 du 13/10)
      const referenceDate = new Date(Date.UTC(2026, 9, 10, 14, 30, 0));

      const reminders = computeApplicableReminders(dateExpiration, referenceDate);

      assert.strictEqual(reminders.length, 1, 'Doit planifier uniquement J-2');
      assert.strictEqual(reminders[0].type, 'J_MINUS_2');

      const expectedJ2 = new Date(Date.UTC(2026, 9, 13, 8, 0, 0));
      assert.strictEqual(reminders[0].scheduledFor.toISOString(), expectedJ2.toISOString());
    });

    it('création après J-2 => aucun rappel planifié', () => {
      // Expiration le 15 octobre 2026
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      // Création le 13 octobre 2026 après 08:00 (J-2 est déjà passé)
      const referenceDate = new Date(Date.UTC(2026, 9, 13, 9, 0, 0));

      const reminders = computeApplicableReminders(dateExpiration, referenceDate);

      assert.strictEqual(reminders.length, 0, 'Aucun rappel ne doit être planifié si J-2 est passé');
    });

    it('création le jour même ou après expiration => aucun rappel', () => {
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 0, 0, 0));
      const referenceDate = new Date(Date.UTC(2026, 9, 16, 12, 0, 0));

      const reminders = computeApplicableReminders(dateExpiration, referenceDate);

      assert.strictEqual(reminders.length, 0);
    });
  });

  describe('2. Protection anti-duplication des rappels', () => {
    it('aucune duplication J-7/J-2 si déjà PREVU ou ENVOYE', () => {
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      const referenceDate = new Date(Date.UTC(2026, 9, 1, 10, 0, 0));
      const planned = computeApplicableReminders(dateExpiration, referenceDate);

      // Simuler qu'un rappel J-7 est déjà PREVU
      const existingReminders: Array<{ type: 'J_MINUS_7' | 'J_MINUS_2'; statut: 'PREVU' | 'ENVOYE' | 'ANNULE' }> = [
        { type: 'J_MINUS_7', statut: 'PREVU' },
      ];

      const deduplicated = filterDuplicateReminders(planned, existingReminders as any);

      assert.strictEqual(deduplicated.length, 1, 'Seul J-2 doit être retenu');
      assert.strictEqual(deduplicated[0].type, 'J_MINUS_2');
    });

    it('autorise la replanification si l’ancien rappel est ANNULE', () => {
      const dateExpiration = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      const referenceDate = new Date(Date.UTC(2026, 9, 1, 10, 0, 0));
      const planned = computeApplicableReminders(dateExpiration, referenceDate);

      // Simuler que les anciens rappels sont tous ANNULE
      const existingReminders: Array<{ type: 'J_MINUS_7' | 'J_MINUS_2'; statut: 'PREVU' | 'ENVOYE' | 'ANNULE' }> = [
        { type: 'J_MINUS_7', statut: 'ANNULE' },
        { type: 'J_MINUS_2', statut: 'ANNULE' },
      ];

      const deduplicated = filterDuplicateReminders(planned, existingReminders as any);

      assert.strictEqual(deduplicated.length, 2, 'Les deux rappels doivent pouvoir être créés à nouveau');
    });
  });

  describe('3. Modification de date et renouvellement', () => {
    it('modification expiration => anciens PREVU annulés + nouveaux calculés', () => {
      const contract: ContractData = {
        id: 'c-1',
        numeroPolice: 'POL-001',
        compagnie: 'Sonam',
        assureNom: 'Amadou Diallo',
        immatriculation: 'DK-1234-AA',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2026, 9, 15)),
        statut: 'VALIDE',
        sourceMode: 'MANUEL',
        clientPhone: '+221770000000',
      };

      const existingReminders: ReminderData[] = [
        {
          id: 'rem-1',
          contractId: 'c-1',
          type: 'J_MINUS_7',
          scheduledFor: new Date(Date.UTC(2026, 9, 8, 8, 0, 0)),
          statut: 'PREVU',
        },
        {
          id: 'rem-2',
          contractId: 'c-1',
          type: 'J_MINUS_2',
          scheduledFor: new Date(Date.UTC(2026, 9, 13, 8, 0, 0)),
          statut: 'PREVU',
        },
      ];

      // On prolonge le contrat jusqu'au 20 novembre 2026
      const newExpiration = new Date(Date.UTC(2026, 10, 20, 23, 59, 59));
      const referenceDate = new Date(Date.UTC(2026, 9, 5, 10, 0, 0));

      const result = InsuranceContractDomainService.rescheduleExpiration({
        contract,
        newExpirationDate: newExpiration,
        existingReminders,
        referenceDate,
      });

      // 1. Tous les anciens rappels PREVU doivent être passés à ANNULE
      assert.strictEqual(result.updatedReminders.length, 2);
      assert.strictEqual(result.updatedReminders[0].statut, 'ANNULE');
      assert.strictEqual(result.updatedReminders[1].statut, 'ANNULE');

      // 2. Le contrat a sa nouvelle date
      assert.strictEqual(result.updatedContract.dateExpiration.getTime(), newExpiration.getTime());

      // 3. De nouveaux rappels J-7 (13 nov) et J-2 (18 nov) sont calculés
      assert.strictEqual(result.newReminders.length, 2);
      assert.strictEqual(result.newReminders[0].type, 'J_MINUS_7');
      assert.strictEqual(
        result.newReminders[0].scheduledFor.toISOString(),
        new Date(Date.UTC(2026, 10, 13, 8, 0, 0)).toISOString()
      );
      assert.strictEqual(result.newReminders[1].type, 'J_MINUS_2');
      assert.strictEqual(
        result.newReminders[1].scheduledFor.toISOString(),
        new Date(Date.UTC(2026, 10, 18, 8, 0, 0)).toISOString()
      );
    });

    it('renouvellement => historique conservé + ancienne période clôturée + nouvelle période créée', () => {
      const oldContract: ContractData = {
        id: 'c-old',
        numeroPolice: 'POL-001',
        compagnie: 'Sonam',
        assureNom: 'Amadou Diallo',
        immatriculation: 'DK-1234-AA',
        dateDebut: new Date(Date.UTC(2025, 9, 15)),
        dateExpiration: new Date(Date.UTC(2026, 9, 15)),
        statut: 'VALIDE',
        sourceMode: 'MANUEL',
        clientPhone: '+221770000000',
      };

      const oldReminders: ReminderData[] = [
        {
          id: 'r-old-1',
          contractId: 'c-old',
          type: 'J_MINUS_7',
          scheduledFor: new Date(Date.UTC(2026, 9, 8, 8, 0, 0)),
          statut: 'PREVU',
        },
      ];

      const renewalResult = InsuranceContractDomainService.renewContract({
        oldContract,
        oldReminders,
        newPeriodData: {
          numeroPolice: 'POL-001-RENEWED',
          compagnie: 'Sonam',
          assureNom: 'Amadou Diallo',
          immatriculation: 'DK-1234-AA',
          dateDebut: new Date(Date.UTC(2026, 9, 16)),
          dateExpiration: new Date(Date.UTC(2027, 9, 15)),
          sourceMode: 'MANUEL',
          clientPhone: '+221770000000',
        },
        referenceDate: new Date(Date.UTC(2026, 9, 1, 10, 0, 0)),
      });

      // 1. L'ancien contrat est clôturé avec statut RENOUVELE
      assert.strictEqual(renewalResult.closedOldContract.statut, 'RENOUVELE');
      assert.strictEqual(renewalResult.closedOldReminders[0].statut, 'ANNULE');

      // 2. Le nouveau contrat pointe vers l'ancien (conservation historique)
      assert.strictEqual(renewalResult.newContract.previousContractId, 'c-old');
      assert.strictEqual(renewalResult.newContract.statut, 'VALIDE');

      // 3. De nouveaux rappels sont initialisés pour la nouvelle période
      assert.strictEqual(renewalResult.newReminders.length, 2);
      assert.strictEqual(renewalResult.newReminders[0].type, 'J_MINUS_7');
      assert.strictEqual(renewalResult.newReminders[1].type, 'J_MINUS_2');
    });
  });

  describe('4. Sécurité Cryptographique des Jetons', () => {
    it('token >= 256 bits d’entropie', () => {
      const { rawToken } = generateAttestationToken();

      // Décoder depuis base64url
      const buffer = Buffer.from(rawToken, 'base64url');
      assert.ok(buffer.length >= 32, `Longueur en octets ${buffer.length} doit être >= 32 octets (256 bits)`);
      assert.strictEqual(hasSufficientEntropy(rawToken), true);
    });

    it('hash SHA-256 calculé avec exactitude (64 caractères hexadécimaux)', () => {
      const { rawToken, tokenHash } = generateAttestationToken();

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      assert.strictEqual(tokenHash, expectedHash);
      assert.strictEqual(tokenHash.length, 64);
      assert.match(tokenHash, /^[a-f0-9]{64}$/);
    });

    it('token brut JAMAIS présent dans l’enregistrement persisté', () => {
      const creation = InsuranceContractDomainService.createContract({
        contract: {
          numeroPolice: 'POL-002',
          compagnie: 'AXA',
          assureNom: 'Fatou Sow',
          immatriculation: 'TH-5678-BB',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          sourceMode: 'MANUEL',
          clientPhone: '+221780000000',
        },
        attestation: {
          pdfStoragePath: 'attestations/axa/att-123.pdf',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          statut: 'VALIDE',
        },
      });

      assert.ok(creation.token, 'Le token doit être généré');
      const stored = creation.token.record;

      // Vérifier que le jeton brut n'est pas dans l'objet persisté
      assert.strictEqual((stored as any).rawToken, undefined, 'rawToken ne doit pas figurer dans le record persisté');
      assert.ok(stored.tokenHash, 'tokenHash doit être présent');
      assert.strictEqual(stored.tokenHash, hashToken(creation.token.rawToken));
    });

    it('expiration token = expiration attestation', () => {
      const attestationExpiration = new Date(Date.UTC(2027, 5, 30, 23, 59, 59));

      const creation = InsuranceContractDomainService.createContract({
        contract: {
          numeroPolice: 'POL-003',
          compagnie: 'Allianz',
          assureNom: 'Moussa Ndiaye',
          immatriculation: 'SL-9999-CC',
          dateDebut: new Date(Date.UTC(2026, 5, 30)),
          dateExpiration: attestationExpiration,
          sourceMode: 'MANUEL',
          clientPhone: '+221760000000',
        },
        attestation: {
          pdfStoragePath: 'attestations/allianz/att-999.pdf',
          dateDebut: new Date(Date.UTC(2026, 5, 30)),
          dateExpiration: attestationExpiration,
          statut: 'VALIDE',
        },
      });

      assert.ok(creation.token);
      assert.strictEqual(
        creation.token.record.expiresAt.getTime(),
        attestationExpiration.getTime(),
        'La date d’expiration du token doit correspondre exactement à celle de l’attestation'
      );
    });

    it('révocation de token invalide immédiatement l’accès', () => {
      const { rawToken, tokenHash } = generateAttestationToken();
      const expiresAt = new Date(Date.now() + 86400000 * 30);

      const record = {
        tokenHash,
        expiresAt,
        revokedAt: null as Date | null,
      };

      // 1. Avant révocation : valide
      const resBefore = validateAttestationAccessToken(record, {
        statut: 'VALIDE',
        dateExpiration: expiresAt,
      });
      assert.strictEqual(resBefore.valid, true);

      // 2. Révocation
      const revoked = InsuranceContractDomainService.revokeToken(record, new Date());
      assert.ok(revoked.revokedAt !== null);

      // 3. Après révocation : invalide
      const resAfter = validateAttestationAccessToken(revoked, {
        statut: 'VALIDE',
        dateExpiration: expiresAt,
      });
      assert.strictEqual(resAfter.valid, false);
      assert.strictEqual(resAfter.reason, 'TOKEN_REVOKED');
    });

    it('token expiré est rejeté', () => {
      const { tokenHash } = generateAttestationToken();
      const pastExpiration = new Date(Date.now() - 1000); // Expiré il y a 1 seconde

      const record = {
        tokenHash,
        expiresAt: pastExpiration,
        revokedAt: null,
      };

      const result = validateAttestationAccessToken(record);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, 'TOKEN_EXPIRED');
    });
  });

  describe('5. Règle absolue : Aucune génération de token sans attestation PDF disponible', () => {
    it('aucune génération de token si aucune attestation n’est fournie', () => {
      const creation = InsuranceContractDomainService.createContract({
        contract: {
          numeroPolice: 'POL-004',
          compagnie: 'Sonam',
          assureNom: 'Ousmane Ba',
          immatriculation: 'DK-4444-DD',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          sourceMode: 'MANUEL',
          clientPhone: '+221770000000',
          statut: 'VALIDE',
        },
        attestation: null,
      });

      assert.strictEqual(
        creation.token,
        null,
        'Aucun token ne doit être généré sans attestation disponible'
      );
    });

    it('aucune génération de token si l’attestation n’a pas de pdfStoragePath', () => {
      const creation = InsuranceContractDomainService.createContract({
        contract: {
          numeroPolice: 'POL-005',
          compagnie: 'Sonam',
          assureNom: 'Awa Fall',
          immatriculation: 'DK-5555-EE',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          sourceMode: 'MANUEL',
          clientPhone: '+221770000000',
          statut: 'VALIDE',
        },
        attestation: {
          pdfStoragePath: null, // Pas encore généré/téléversé
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          statut: 'VALIDE',
        },
      });

      assert.strictEqual(
        creation.token,
        null,
        'Aucun token ne doit être généré si le fichier PDF n’est pas disponible'
      );
    });

    it('aucune génération de token si l’attestation n’est pas à l’état VALIDE', () => {
      const creation = InsuranceContractDomainService.createContract({
        contract: {
          numeroPolice: 'POL-006',
          compagnie: 'Sonam',
          assureNom: 'Cheikh Sarr',
          immatriculation: 'DK-6666-FF',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          sourceMode: 'AUTOMATIQUE',
          clientPhone: '+221770000000',
        },
        attestation: {
          pdfStoragePath: 'temp/raw-attestation.pdf',
          dateDebut: new Date(Date.UTC(2026, 0, 1)),
          dateExpiration: new Date(Date.UTC(2026, 11, 31)),
          statut: 'EN_ATTENTE', // Pas encore validée
        },
      });

      assert.strictEqual(
        creation.token,
        null,
        'Aucun token ne doit être généré tant que l’attestation n’est pas validée'
      );
    });
  });

  describe('6. Remplacement d’attestation (attestation corrigée/remplacée)', () => {
    it('ancien token révoqué, nouveau token généré avec validité conforme', () => {
      const oldAttestation: AttestationData = {
        id: 'att-1',
        pdfStoragePath: 'attestations/v1.pdf',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2026, 11, 31)),
        statut: 'VALIDE',
      };

      const oldToken = {
        tokenHash: 'oldhash123',
        expiresAt: oldAttestation.dateExpiration,
        revokedAt: null,
      };

      const newAttestation: AttestationData = {
        id: 'att-2',
        pdfStoragePath: 'attestations/v2_corrected.pdf',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2027, 0, 15)),
        statut: 'VALIDE',
      };

      const actionDate = new Date(Date.UTC(2026, 5, 1));

      const replacement = InsuranceContractDomainService.replaceAttestation({
        oldAttestation,
        oldTokenRecord: oldToken,
        newAttestation,
        actionDate,
      });

      // 1. Ancienne attestation marquée REMPLACEE
      assert.strictEqual(replacement.updatedOldAttestation.statut, 'REMPLACEE');

      // 2. Ancien token révoqué
      assert.ok(replacement.revokedOldToken !== null);
      assert.strictEqual(
        replacement.revokedOldToken.revokedAt?.toISOString(),
        actionDate.toISOString()
      );

      // 3. Nouveau token créé avec validité calquée sur la nouvelle attestation
      assert.ok(replacement.newToken !== null);
      assert.strictEqual(
        replacement.newToken.record.expiresAt.toISOString(),
        newAttestation.dateExpiration.toISOString()
      );
      assert.strictEqual(replacement.newToken.record.revokedAt, null);
    });
  });
});
