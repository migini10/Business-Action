import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { checkRateLimit, searchDossiers, unlockDossierDocuments } from './suivi';
import prisma from '@/lib/prisma';

let currentMockHeaders = new Headers({ 'x-businessaction-client-ip': '127.0.0.1' });

// Create mocks for next/headers
mock.module('next/headers', {
  namedExports: {
    headers: async () => currentMockHeaders,
    cookies: async () => ({
      set: (key: string, val: string, opts: any) => {},
      get: (key: string) => ({ value: 'test' })
    })
  }
});

describe('Suivi & Rate Limiter', () => {
  const originalEnv = process.env.RATE_LIMIT_SECRET;

  before(async () => {
    process.env.RATE_LIMIT_SECRET = 'test_secret';
    await prisma.$executeRaw`TRUNCATE TABLE "RateLimitWindow"`;
    // Add test dossiers
    await prisma.dossier.createMany({
      data: [
        { id: 'test_dossier_1', numeroDossier: 'DOS-TEST-1', phone: '788696800', typeVehicule: 'PARTICULIER', statut: 'VALIDE', devisUrl: 'http://test1.pdf' },
        { id: 'test_dossier_2', numeroDossier: 'DOS-TEST-2', phone: '771234567', typeVehicule: 'UTILITAIRE', statut: 'EN_ATTENTE', devisUrl: 'http://test2.pdf' },
        { id: 'test_dossier_3', numeroDossier: 'DOS-TEST-3', phone: '771234567', typeVehicule: 'POIDS_LOURD', statut: 'EN_ATTENTE' },
        { id: 'test_dossier_norm_1', numeroDossier: 'DOS-NORM-1', phone: '788696800', typeVehicule: 'PARTICULIER', statut: 'VALIDE', devisUrl: 'url' },
        { id: 'test_dossier_norm_2', numeroDossier: 'DOS-NORM-2', phone: '+221788696800', typeVehicule: 'PARTICULIER', statut: 'VALIDE', devisUrl: 'url' }
      ]
    });

    const now = new Date();
    const future = new Date(now.getTime() + 86400000); // Tomorrow
    const past = new Date(now.getTime() - 86400000); // Yesterday

    await prisma.dossierDocument.createMany({
      data: [
        // Dossier 1: Document actif
        { id: 'doc_1', dossierId: 'test_dossier_1', type: 'CARTE_GRISE', side: 'RECTO', storagePath: '/test1.jpg', mimeType: 'image/jpeg', expiresAt: future },
        // Dossier 2: Document expiré et Document supprimé
        { id: 'doc_2', dossierId: 'test_dossier_2', type: 'CMC', side: 'SINGLE', storagePath: '/test2.pdf', mimeType: 'application/pdf', expiresAt: past },
        { id: 'doc_3', dossierId: 'test_dossier_2', type: 'CARTE_GRISE', side: 'VERSO', storagePath: '/test3.jpg', mimeType: 'image/jpeg', expiresAt: future, deletedAt: now },
        // Norm tests
        { id: 'doc_norm_1', dossierId: 'test_dossier_norm_1', type: 'CARTE_GRISE', side: 'SINGLE', storagePath: '/n1.jpg', mimeType: 'image/jpeg', expiresAt: future },
        { id: 'doc_norm_2', dossierId: 'test_dossier_norm_2', type: 'CARTE_GRISE', side: 'SINGLE', storagePath: '/n2.jpg', mimeType: 'image/jpeg', expiresAt: future }
      ]
    });
  });

  after(async () => {
    process.env.RATE_LIMIT_SECRET = originalEnv;
    await prisma.$executeRaw`TRUNCATE TABLE "RateLimitWindow"`;
    await prisma.dossierDocument.deleteMany({ where: { dossierId: { in: ['test_dossier_1', 'test_dossier_2', 'test_dossier_3', 'test_dossier_norm_1', 'test_dossier_norm_2'] } } });
    await prisma.dossier.deleteMany({ where: { numeroDossier: { in: ['DOS-TEST-1', 'DOS-TEST-2', 'DOS-TEST-3', 'DOS-NORM-1', 'DOS-NORM-2'] } } });
  });

  it('A. Recherche numéro dossier seul', async () => {
    const res = await searchDossiers({ numeroDossier: 'DOS-TEST-1' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.type, 'dossier');
    assert.strictEqual(res.dossiers![0].numeroDossier, 'DOS-TEST-1');
    assert.strictEqual(res.dossiers![0].hasPrivateDocuments, true, "dossier avec document actif => hasPrivateDocuments true");
    assert.ok(res.dossiers![0].createdAt);
    assert.strictEqual((res.dossiers![0] as any).devisUrl, undefined, "recherche publique => aucune donnée document sensible exposée");
  });

  it('B. Recherche téléphone seul', async () => {
    const res = await searchDossiers({ phone: '771234567' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.type, 'phone');
    assert.strictEqual(res.dossiers!.length, 3);

    const d1 = res.dossiers!.find(d => d.typeVehicule === 'PARTICULIER'); // test_dossier_1
    const d2 = res.dossiers!.find(d => d.typeVehicule === 'UTILITAIRE'); // test_dossier_2
    const d3 = res.dossiers!.find(d => d.typeVehicule === 'POIDS_LOURD'); // test_dossier_3

    assert.strictEqual(d1!.hasPrivateDocuments, true, "Dossier 1 doit avoir hasPrivateDocuments = true");
    assert.strictEqual(d2!.hasPrivateDocuments, false, "document expiré ou deletedAt non null => ignoré");
    assert.strictEqual(d3!.hasPrivateDocuments, false, "dossier sans document => false");

    assert.strictEqual(d1!.numeroDossier, 'DOS-****-1'); // Masked
    assert.strictEqual((d1 as any).devisUrl, undefined);
  });

  it('C. Recherche téléphone sans résultat', async () => {
    const res = await searchDossiers({ phone: '00000' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Informations de suivi incorrectes.');
  });

  it('D. Recherche numéro dossier sans résultat', async () => {
    const res = await searchDossiers({ numeroDossier: 'DOS-INVALID' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Informations de suivi incorrectes.');
  });

  it('E. Recherche publique (aucun devisUrl)', async () => {
    const res = await searchDossiers({ numeroDossier: 'DOS-TEST-1' });
    assert.strictEqual((res.dossiers![0] as any).devisUrl, undefined);
  });

  it('F. Double preuve correcte (Unlock)', async () => {
    const res = await unlockDossierDocuments('DOS-TEST-1', '788696800');
    assert.strictEqual(res.success, true);
    assert.strictEqual(Array.isArray(res.documents), true);
    assert.strictEqual((res as any).devisUrl, undefined);
  });

  it('G. Double preuve incorrecte', async () => {
    const res = await unlockDossierDocuments('DOS-TEST-1', 'WRONG');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Informations de vérification incorrectes.');
  });

  it('Test A. DB 788696800, saisie 788696800 => PASS', async () => {
    const res = await unlockDossierDocuments('DOS-NORM-1', '788696800');
    assert.strictEqual(res.success, true);
  });

  it('Test B. DB +221788696800, saisie 788696800 => PASS', async () => {
    const res = await unlockDossierDocuments('DOS-NORM-2', '788696800');
    assert.strictEqual(res.success, true);
  });

  it('Test C. DB 788696800, saisie +221 78 869 68 00 => PASS', async () => {
    const res = await unlockDossierDocuments('DOS-NORM-1', '+221 78 869 68 00');
    assert.strictEqual(res.success, true);
  });

  it('Test D. téléphone différent => DENY', async () => {
    const res = await unlockDossierDocuments('DOS-NORM-1', '771234567');
    assert.strictEqual(res.success, false);
  });

  it('Test E. numeroDossier incorrect => DENY', async () => {
    const res = await unlockDossierDocuments('DOS-INVALIDE', '788696800');
    assert.strictEqual(res.success, false);
  });

  it('A. double preuve correcte + documents actifs => success true + documents retournés', async () => {
    // DOS-TEST-1 has 1 active doc
    const res = await unlockDossierDocuments('DOS-TEST-1', '788696800');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.documents?.length, 1);
    assert.strictEqual(res.documents?.[0].type, 'CARTE_GRISE');
  });

  it('B. double preuve correcte + aucun document => success true + documents []', async () => {
    // DOS-TEST-3 has no documents
    const res = await unlockDossierDocuments('DOS-TEST-3', '771234567');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.documents?.length, 0);
  });

  it('C, D, E. documents supprimés ou expirés absents + pas de données sensibles', async () => {
    // DOS-TEST-2 has 2 docs: 1 expired, 1 deleted. Should return empty.
    const res = await unlockDossierDocuments('DOS-TEST-2', '771234567');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.documents?.length, 0);
    assert.strictEqual((res as any).devisUrl, undefined);
    assert.strictEqual((res.documents as any)?.[0]?.storagePath, undefined);
  });

  it('Test H. aucune TrackingSession sur échec', async () => {
    const beforeCount = await prisma.trackingSession.count();
    await unlockDossierDocuments('DOS-NORM-1', '771234567');
    const afterCount = await prisma.trackingSession.count();
    assert.strictEqual(afterCount, beforeCount);
  });

  it('I. Rate limit recherche (A. Sequential requests: 1-5 allowed, 6 refused)', async () => {
    const ip = '1.1.1.1';
    for (let i = 1; i <= 5; i++) {
      const allowed = await checkRateLimit(ip);
      assert.strictEqual(allowed, true);
    }
    const allowed6 = await checkRateLimit(ip);
    assert.strictEqual(allowed6, false);
  });

  it('B. quotas indépendants', async () => {
    const ipA = 'userA';
    const ipB = 'userB';
    for (let i = 1; i <= 5; i++) {
      await checkRateLimit(ipA);
    }
    // ipA is blocked
    assert.strictEqual(await checkRateLimit(ipA), false);
    // ipB is still allowed
    assert.strictEqual(await checkRateLimit(ipB), true);
  });

  it('C. header interne absent => DENY => aucune recherche dossier', async () => {
    // Modify mock to return no header
    currentMockHeaders = new Headers({});
    const res = await searchDossiers({ numeroDossier: 'DOS-TEST-1' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "Trop de tentatives. Veuillez réessayer plus tard.");

    // Restore mock
    currentMockHeaders = new Headers({ 'x-businessaction-client-ip': '127.0.0.1' });
  });

  it('G. aucun unknown dans la logique rate-limit', async () => {
    // Calling checkRateLimit with null directly
    const allowed = await checkRateLimit(null);
    assert.strictEqual(allowed, false);
  });

  it('H. RateLimitWindow contient uniquement ipHash, jamais IP brute', async () => {
    const ip = 'secret-ip-address';
    await checkRateLimit(ip);

    const rows = await prisma.$queryRaw<any[]>`SELECT "ipHash" FROM "RateLimitWindow"`;
    const found = rows.find(r => r.ipHash.includes('secret-ip-address'));
    assert.strictEqual(found, undefined);
  });
});

import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

describe('Middleware IP Headers', () => {
  const originalEnv = process.env.NODE_ENV;

  after(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv });
  });

  const setEnv = (val: string) => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: val, configurable: true });
  };

  it('D. header x-businessaction-client-ip fourni par navigateur écrasé par middleware', () => {
    setEnv('production');
    const req = new NextRequest('http://localhost/suivi', {
      headers: {
        'x-vercel-forwarded-for': '2.2.2.2',
        'x-businessaction-client-ip': 'hacker-ip'
      }
    });
    const res = middleware(req);
    // NextRequest headers in middleware response are available in the internal headers object or we can check logic
    const modifiedHeaders = (res as any).headers;
    // Actually, NextResponse doesn't easily expose the modified request headers in tests like this without accessing internal symbols.
    // Instead we can just verify the logic locally. Next 13+ middleware returns a response with x-middleware-request-* headers.
    const internalIp = modifiedHeaders.get('x-middleware-request-x-businessaction-client-ip');
    assert.strictEqual(internalIp, '2.2.2.2');
  });

  it('E. x-vercel-forwarded-for absent en Production => aucun header interne généré', () => {
    setEnv('production');
    const req = new NextRequest('http://localhost/suivi', {
      headers: {
        'x-forwarded-for': '1.1.1.1' // Ignored in prod now
      }
    });
    const res = middleware(req);
    const internalIp = (res as any).headers.get('x-middleware-request-x-businessaction-client-ip');
    assert.strictEqual(internalIp, null);
  });

  it('F. local => identité locale stable autorisée', () => {
    setEnv('development');
    const req = new NextRequest('http://localhost/suivi', {
      headers: {}
    });
    const res = middleware(req);
    const internalIp = (res as any).headers.get('x-middleware-request-x-businessaction-client-ip');
    assert.strictEqual(internalIp, '127.0.0.1');
  });
});
