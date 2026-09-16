/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import sharp from 'sharp';
import {
  validatePdfBuffer,
  validateImageBuffer,
  normalizeAttestationImage,
  generateAttestationStoragePaths,
  uploadAttestationFiles,
  getAttestationPdfBuffer,
  deleteAttestationFiles,
  MAX_PDF_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
} from './attestation-storage';
import { hashToken, generateAttestationToken } from './attestation-token';
import { InsuranceContractDomainService } from './contract-service';

// Mocking Prisma for route tests
const mockPrisma: any = {
  attestationAccessToken: {
    findUnique: async () => null,
    update: async () => ({}),
  },
};

require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true },
} as any;

// Mocking attestation-storage for route tests
let mockPdfContent = Buffer.from('%PDF-1.4 Sample Insurance Certificate Content %EOF');
const mockAttestationStorage: any = {
  getAttestationPdfBuffer: async (path: string) => {
    if (path === 'valid/path/attestation.pdf') {
      return mockPdfContent;
    }
    throw new Error('File not found in storage');
  },
};

require.cache[require.resolve('./attestation-storage')] = {
  id: require.resolve('./attestation-storage'),
  filename: require.resolve('./attestation-storage'),
  loaded: true,
  exports: {
    ...require('./attestation-storage'),
    getAttestationPdfBuffer: mockAttestationStorage.getAttestationPdfBuffer,
  },
} as any;

const { GET } = require('../../app/a/[token]/route');

describe('Phase 2 — Attestation Storage, Sécurité & Route Publique', () => {
  describe('1. Validation des formats et Magic Bytes réels', () => {
    it('PDF valide (%PDF) accepté', () => {
      const validPdf = Buffer.from('%PDF-1.5 test document header content');
      assert.doesNotThrow(() => validatePdfBuffer(validPdf));
    });

    it('mauvais magic bytes PDF rejetés', () => {
      const fakePdf = Buffer.from('NOT_A_PDF_FILE');
      assert.throws(() => validatePdfBuffer(fakePdf), /Signature binaire invalide/);
    });

    it('fichier PDF trop gros rejeté (> 10MB)', () => {
      // Simuler un buffer qui dépasse MAX_PDF_SIZE_BYTES
      const oversized = Buffer.alloc(MAX_PDF_SIZE_BYTES + 1);
      oversized.write('%PDF-1.4');
      assert.throws(() => validatePdfBuffer(oversized), /dépasse la taille maximale/);
    });

    it('image JPEG acceptée et validée', async () => {
      const jpegBuffer = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();

      assert.doesNotThrow(() => validateImageBuffer(jpegBuffer));
    });

    it('image PNG acceptée et validée', async () => {
      const pngBuffer = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } },
      })
        .png()
        .toBuffer();

      assert.doesNotThrow(() => validateImageBuffer(pngBuffer));
    });

    it('format image non autorisé rejeté (ex: texte ou gif)', () => {
      const textBuffer = Buffer.from('GIF89a Fake gif');
      assert.throws(() => validateImageBuffer(textBuffer), /Format d'image non autorisé/);
    });

    it('fichier image trop gros rejeté (> 10MB)', () => {
      const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
      oversized[0] = 0xff;
      oversized[1] = 0xd8;
      oversized[2] = 0xff;
      assert.throws(() => validateImageBuffer(oversized), /dépasse la taille maximale/);
    });
  });

  describe('2. Normalisation Image → PNG via Sharp', () => {
    it('image JPEG normalisée en PNG authentique (magic bytes 89504E47)', async () => {
      const jpegBuffer = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 100, g: 150, b: 200 } },
      })
        .jpeg()
        .toBuffer();

      const normalized = await normalizeAttestationImage(jpegBuffer);

      assert.ok(Buffer.isBuffer(normalized));
      // Vérification des magic bytes PNG : 89 50 4E 47
      assert.strictEqual(normalized.toString('hex', 0, 4).toUpperCase(), '89504E47');
    });

    it('image PNG normalisée conserve le format PNG standard', async () => {
      const pngBuffer = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 50, g: 50, b: 50 } },
      })
        .png()
        .toBuffer();

      const normalized = await normalizeAttestationImage(pngBuffer);

      assert.ok(Buffer.isBuffer(normalized));
      assert.strictEqual(normalized.toString('hex', 0, 4).toUpperCase(), '89504E47');
    });
  });

  describe('3. Génération des chemins et stockage sécurisé privé', () => {
    it('génération de chemins serveur étanches (aucun path traversal)', () => {
      const paths = generateAttestationStoragePaths('../../dangerous/contract-123');

      assert.ok(!paths.pdfStoragePath.includes('..'), 'Ne doit pas contenir de path traversal');
      assert.ok(!paths.pdfStoragePath.startsWith('/'), 'Ne doit pas commencer par un slash absolu');
      assert.ok(paths.pdfStoragePath.startsWith('attestations/'));
      assert.ok(paths.pdfStoragePath.endsWith('/attestation.pdf'));
      assert.ok(paths.pngStoragePath.endsWith('/attestation.png'));
    });

    it('upload sécurisé dans le bucket privé avec rollback en cas d’échec partiel', async () => {
      const uploaded: string[] = [];
      const deleted: string[] = [];

      const mockSupabase = {
        storage: {
          from: () => ({
            upload: async (path: string) => {
              if (path.endsWith('attestation.png')) {
                // Simuler une défaillance lors de l'upload du PNG
                return { error: new Error('Simulated PNG upload failure') };
              }
              uploaded.push(path);
              return { data: { path }, error: null };
            },
            remove: async (paths: string[]) => {
              deleted.push(...paths);
              return { data: {}, error: null };
            },
          }),
        },
      };

      const pdf = Buffer.from('%PDF-1.4 dummy pdf');
      const png = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .png()
        .toBuffer();

      await assert.rejects(
        async () => {
          await uploadAttestationFiles({
            contractId: 'ctr-test',
            pdfBuffer: pdf,
            imageBuffer: png,
            supabaseClient: mockSupabase,
            bucketName: 'private-attestations',
          });
        },
        /Simulated PNG upload failure/
      );

      // Le rollback a bien supprimé le PDF téléversé avant l'échec du PNG
      assert.strictEqual(uploaded.length, 1);
      assert.strictEqual(deleted.length, 1);
      assert.strictEqual(deleted[0], uploaded[0]);
    });

    it('getAttestationPdfBuffer refuse les chemins suspects (path traversal)', async () => {
      await assert.rejects(
        async () => {
          await getAttestationPdfBuffer('../../../etc/passwd');
        },
        /Chemin de stockage non autorisé/
      );

      await assert.rejects(
        async () => {
          await getAttestationPdfBuffer('/root/secret.pdf');
        },
        /Chemin de stockage non autorisé/
      );
    });
  });

  describe('4. Route publique de téléchargement GET /a/[token]', () => {
    let updateCallArgs: any = null;

    beforeEach(() => {
      updateCallArgs = null;
      mockPrisma.attestationAccessToken.update = async (args: any) => {
        updateCallArgs = args;
        return args;
      };
    });

    it('token valide → délivre directement le PDF avec headers sécurisés', async () => {
      const rawToken = 'sample_valid_token_32_bytes_long_string';
      const tokenHash = hashToken(rawToken);

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // J+30

      mockPrisma.attestationAccessToken.findUnique = async ({ where }: any) => {
        if (where.tokenHash === tokenHash) {
          return {
            id: 'tok-1',
            tokenHash,
            expiresAt: futureDate,
            revokedAt: null,
            downloadCount: 5,
            lastDownloadedAt: null,
            attestation: {
              statut: 'VALIDE',
              dateExpiration: futureDate,
              pdfStoragePath: 'valid/path/attestation.pdf',
              contract: {
                numeroPolice: 'POL-SONAM-2026',
              },
            },
          };
        }
        return null;
      };

      const req = new Request(`http://localhost/a/${rawToken}`);
      const res = await GET(req, { params: Promise.resolve({ token: rawToken }) });

      assert.strictEqual(res.status, 200);

      // Headers sécurisés obligatoires
      assert.strictEqual(res.headers.get('Content-Type'), 'application/pdf');
      assert.strictEqual(
        res.headers.get('Content-Disposition'),
        'attachment; filename="Attestation_POL-SONAM-2026.pdf"'
      );
      assert.strictEqual(
        res.headers.get('Cache-Control'),
        'private, no-store, no-cache, must-revalidate, max-age=0'
      );
      assert.strictEqual(res.headers.get('Pragma'), 'no-cache');
      assert.strictEqual(res.headers.get('Expires'), '0');
      assert.strictEqual(res.headers.get('Referrer-Policy'), 'no-referrer');
      assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');

      // Corps = buffer PDF
      const bodyArrayBuffer = await res.arrayBuffer();
      const bodyBuffer = Buffer.from(bodyArrayBuffer);
      assert.strictEqual(bodyBuffer.toString(), mockPdfContent.toString());

      // Vérification incrément atomique et lastDownloadedAt
      assert.ok(updateCallArgs !== null);
      assert.strictEqual(updateCallArgs.where.id, 'tok-1');
      assert.strictEqual(updateCallArgs.data.downloadCount.increment, 1);
      assert.ok(updateCallArgs.data.lastDownloadedAt instanceof Date);

      // Aucun storagePath ni URL Supabase exposés dans les headers
      assert.strictEqual(res.headers.get('x-storage-path'), null);
      assert.strictEqual(res.headers.get('location'), null);
    });

    it('A. Supabase download échoue => 500, aucun PDF délivré, downloadCount NON incrémenté', async () => {
      const rawToken = 'storage_failure_token';
      const tokenHash = hashToken(rawToken);
      const futureDate = new Date(Date.now() + 100000);

      mockPrisma.attestationAccessToken.findUnique = async () => ({
        id: 'tok-storage-err',
        tokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        attestation: {
          statut: 'VALIDE',
          dateExpiration: futureDate,
          pdfStoragePath: 'storage/missing/attestation.pdf', // Fera échouer mockAttestationStorage
        },
      });

      const req = new Request(`http://localhost/a/${rawToken}`);
      const res = await GET(req, { params: Promise.resolve({ token: rawToken }) });

      assert.strictEqual(res.status, 500);
      const text = await res.text();
      assert.match(text, /Erreur lors de la récupération du document/);
      // Le compteur de téléchargement ne doit JAMAIS être incrémenté si le PDF échoue
      assert.strictEqual(updateCallArgs, null);
    });

    it('B. PDF récupéré mais update statistique DB échoue => PDF quand même délivré sans erreur client', async () => {
      const rawToken = 'db_update_fail_token';
      const tokenHash = hashToken(rawToken);
      const futureDate = new Date(Date.now() + 100000);

      mockPrisma.attestationAccessToken.findUnique = async () => ({
        id: 'tok-db-fail',
        tokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        attestation: {
          statut: 'VALIDE',
          dateExpiration: futureDate,
          pdfStoragePath: 'valid/path/attestation.pdf',
        },
      });

      // Simuler une coupure de DB lors de la mise à jour des statistiques
      mockPrisma.attestationAccessToken.update = async () => {
        throw new Error('Database connection lost during update');
      };

      const req = new Request(`http://localhost/a/${rawToken}`);
      const res = await GET(req, { params: Promise.resolve({ token: rawToken }) });

      // Le client reçoit son document sans blocage ni fuite d'erreur interne
      assert.strictEqual(res.status, 200);
      const bodyArrayBuffer = await res.arrayBuffer();
      assert.strictEqual(Buffer.from(bodyArrayBuffer).toString(), mockPdfContent.toString());
    });

    it('C. numeroPolice avec accents, espaces, slash, guillemets, CR/LF => Content-Disposition assaini sans injection', async () => {
      const rawToken = 'special_chars_police_token';
      const tokenHash = hashToken(rawToken);
      const futureDate = new Date(Date.now() + 100000);

      mockPrisma.attestationAccessToken.findUnique = async () => ({
        id: 'tok-spec',
        tokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        attestation: {
          statut: 'VALIDE',
          dateExpiration: futureDate,
          pdfStoragePath: 'valid/path/attestation.pdf',
          contract: {
            // Injection potentielle avec CRLF, guillemets et caractères accentués
            numeroPolice: 'POL/SONAM "TEST" \r\n 2026 Éclair & Co',
          },
        },
      });

      const req = new Request(`http://localhost/a/${rawToken}`);
      const res = await GET(req, { params: Promise.resolve({ token: rawToken }) });

      assert.strictEqual(res.status, 200);
      const disposition = res.headers.get('Content-Disposition');
      assert.ok(disposition !== null);

      // Vérification : aucun retour chariot, aucun guillemet injecté, aucun slash
      assert.ok(!disposition.includes('\r'), 'Ne doit pas contenir \\r');
      assert.ok(!disposition.includes('\n'), 'Ne doit pas contenir \\n');
      assert.ok(!disposition.includes('/'), 'Ne doit pas contenir /');
      assert.strictEqual(
        disposition,
        'attachment; filename="Attestation_POL_SONAM__TEST_____2026__clair___Co.pdf"'
      );
    });

    it('D. Headers de sécurité stricts (Pragma=no-cache, Expires=0, Referrer-Policy=no-referrer)', async () => {
      const rawToken = 'sample_headers_test_token';
      const tokenHash = hashToken(rawToken);
      const futureDate = new Date(Date.now() + 100000);

      mockPrisma.attestationAccessToken.findUnique = async () => ({
        id: 'tok-headers',
        tokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        attestation: {
          statut: 'VALIDE',
          dateExpiration: futureDate,
          pdfStoragePath: 'valid/path/attestation.pdf',
          contract: { numeroPolice: 'POL-123' },
        },
      });

      const req = new Request(`http://localhost/a/${rawToken}`);
      const res = await GET(req, { params: Promise.resolve({ token: rawToken }) });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('Pragma'), 'no-cache');
      assert.strictEqual(res.headers.get('Expires'), '0');
      assert.strictEqual(res.headers.get('Referrer-Policy'), 'no-referrer');
      assert.strictEqual(res.headers.get('Cache-Control'), 'private, no-store, no-cache, must-revalidate, max-age=0');
      assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');
    });

    it('E. Tous les états de lien non utilisable retournent le même HTTP 404 uniforme', async () => {
      const futureDate = new Date(Date.now() + 100000);
      const pastDate = new Date(Date.now() - 100000);

      const invalidScenarios = [
        { name: 'token vide', token: '', record: null },
        { name: 'token inconnu', token: 'unknown_tok', record: null },
        {
          name: 'token révoqué',
          token: 'rev_tok',
          record: {
            tokenHash: hashToken('rev_tok'),
            expiresAt: futureDate,
            revokedAt: new Date(),
            attestation: { statut: 'VALIDE', dateExpiration: futureDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'token expiré',
          token: 'exp_tok',
          record: {
            tokenHash: hashToken('exp_tok'),
            expiresAt: pastDate,
            revokedAt: null,
            attestation: { statut: 'VALIDE', dateExpiration: futureDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'attestation expirée',
          token: 'att_exp_tok',
          record: {
            tokenHash: hashToken('att_exp_tok'),
            expiresAt: futureDate,
            revokedAt: null,
            attestation: { statut: 'VALIDE', dateExpiration: pastDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'attestation REMPLACEE',
          token: 'att_rep_tok',
          record: {
            tokenHash: hashToken('att_rep_tok'),
            expiresAt: futureDate,
            revokedAt: null,
            attestation: { statut: 'REMPLACEE', dateExpiration: futureDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'attestation REVOGUEE',
          token: 'att_rev_tok',
          record: {
            tokenHash: hashToken('att_rev_tok'),
            expiresAt: futureDate,
            revokedAt: null,
            attestation: { statut: 'REVOGUEE', dateExpiration: futureDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'attestation ANNULEE',
          token: 'att_ann_tok',
          record: {
            tokenHash: hashToken('att_ann_tok'),
            expiresAt: futureDate,
            revokedAt: null,
            attestation: { statut: 'ANNULEE', dateExpiration: futureDate, pdfStoragePath: 'path' },
          },
        },
        {
          name: 'pdfStoragePath manquant (PDF absent)',
          token: 'att_nopdf_tok',
          record: {
            tokenHash: hashToken('att_nopdf_tok'),
            expiresAt: futureDate,
            revokedAt: null,
            attestation: { statut: 'VALIDE', dateExpiration: futureDate, pdfStoragePath: '' },
          },
        },
      ];

      for (const scenario of invalidScenarios) {
        mockPrisma.attestationAccessToken.findUnique = async () => scenario.record;

        const req = new Request(`http://localhost/a/${scenario.token || 'empty'}`);
        const res = await GET(req, { params: Promise.resolve({ token: scenario.token }) });

        assert.strictEqual(
          res.status,
          404,
          `Le scénario [${scenario.name}] doit retourner HTTP 404`
        );
        const text = await res.text();
        assert.strictEqual(
          text,
          'Document introuvable ou lien invalide.',
          `Le message du scénario [${scenario.name}] doit être uniforme sans divulgation d'état interne`
        );
      }
    });
  });

  describe('5. Remplacement et révocation complète dans la logique métier', () => {
    it('remplacement révoque tous les tokens actifs de l’ancienne attestation', () => {
      const oldAttestation = {
        id: 'att-old',
        pdfStoragePath: 'attestations/old.pdf',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2026, 11, 31)),
        statut: 'VALIDE' as const,
      };

      const oldTokens = [
        {
          id: 'tok-1',
          tokenHash: 'hash-1',
          expiresAt: oldAttestation.dateExpiration,
          revokedAt: null,
        },
        {
          id: 'tok-2',
          tokenHash: 'hash-2',
          expiresAt: oldAttestation.dateExpiration,
          revokedAt: null,
        },
      ];

      const newAttestation = {
        id: 'att-new',
        pdfStoragePath: 'attestations/new.pdf',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2027, 0, 15)),
        statut: 'VALIDE' as const,
      };

      const actionDate = new Date(Date.UTC(2026, 6, 1));

      const result = InsuranceContractDomainService.replaceAttestation({
        oldAttestation,
        oldTokens,
        newAttestation,
        actionDate,
      });

      // L'ancienne attestation est marquée REMPLACEE
      assert.strictEqual(result.updatedOldAttestation.statut, 'REMPLACEE');

      // Tous les anciens tokens sont révoqués
      assert.strictEqual(result.revokedOldTokens.length, 2);
      assert.strictEqual(result.revokedOldTokens[0].revokedAt?.toISOString(), actionDate.toISOString());
      assert.strictEqual(result.revokedOldTokens[1].revokedAt?.toISOString(), actionDate.toISOString());

      // Le nouveau token est créé pour la nouvelle attestation
      assert.ok(result.newToken !== null);
      assert.strictEqual(
        result.newToken.record.expiresAt.toISOString(),
        newAttestation.dateExpiration.toISOString()
      );
      assert.strictEqual(result.newToken.record.revokedAt, null);
    });

    it('revokeAttestation révoque l’attestation et ses tokens', () => {
      const attestation = {
        id: 'att-rev',
        pdfStoragePath: 'attestations/doc.pdf',
        dateDebut: new Date(Date.UTC(2026, 0, 1)),
        dateExpiration: new Date(Date.UTC(2026, 11, 31)),
        statut: 'VALIDE' as const,
      };

      const tokens = [
        {
          id: 't-1',
          tokenHash: 'h-1',
          expiresAt: attestation.dateExpiration,
          revokedAt: null,
        },
      ];

      const actionDate = new Date();
      const res = InsuranceContractDomainService.revokeAttestation({
        attestation,
        tokens,
        actionDate,
        newStatut: 'ANNULEE',
      });

      assert.strictEqual(res.updatedAttestation.statut, 'ANNULEE');
      assert.strictEqual(res.revokedTokens[0].revokedAt, actionDate);
    });
  });
});
