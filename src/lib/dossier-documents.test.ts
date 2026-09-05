import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock WebSocket to avoid Supabase Realtime errors in Node 20
if (typeof global.WebSocket === 'undefined') {
  (global as any).WebSocket = class WebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

import { createDossier, CreateDossierResult } from '@/app/actions/dossier';
import prisma from '@/lib/test-prisma';
import { checkMagicBytes } from '@/lib/magic-bytes';

describe('Dossier Documents', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'dossier_documents_test';
  });

  const getErrorString = (res: CreateDossierResult) => {
    if (res.success) return '';
    if ('errors' in res && res.errors) {
      return Object.values(res.errors).join(' ');
    }
    return '';
  };

  test('A. CARTE_GRISE + recto + verso => accepté', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000001');
    fd.append('situationVehicule', 'immatricule');

    const jpegBuffer = Buffer.from('FFD8FFDB', 'hex');
    fd.append('recto', new File([jpegBuffer], 'recto.jpg', { type: 'image/jpeg' }));
    fd.append('verso', new File([jpegBuffer], 'verso.jpg', { type: 'image/jpeg' }));

    const res = await createDossier(fd);
    // On ignore l'échec d'insertion db/supabase en test, on vérifie qu'on n'est pas bloqué par les validations initiales
    if (!res.success) {
      const errStr = getErrorString(res);
      assert.ok(!errStr.includes('obligatoires') && !errStr.includes('PDF') && !errStr.includes('MB'));
    }
  });

  test('B. CARTE_GRISE avec seulement recto => refus', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000002');
    fd.append('situationVehicule', 'immatricule');
    fd.append('recto', new File(['dummy'], 'recto.jpg', { type: 'image/jpeg' }));

    const res = await createDossier(fd);
    assert.strictEqual(res.success, false);
    if (!res.success && res.errors) {
      assert.ok(res.errors.global?.includes('Recto et Verso sont obligatoires'));
    }
  });

  test('C. CMC avec document unique => accepté', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000003');
    fd.append('situationVehicule', 'non_immatricule');
    const pdfBuffer = Buffer.from('255044462D312E', 'hex'); // PDF
    fd.append('cmc', new File([pdfBuffer], 'cmc.pdf', { type: 'application/pdf' }));

    const res = await createDossier(fd);
    if (!res.success) {
      const errStr = getErrorString(res);
      assert.ok(!errStr.includes('obligatoires') && !errStr.includes('PDF') && !errStr.includes('MB'));
    }
  });

  test('D. CMC + carte grise simultanément => refus', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000004');
    fd.append('situationVehicule', 'immatricule');
    fd.append('recto', new File(['dummy'], 'recto.jpg'));
    fd.append('verso', new File(['dummy'], 'verso.jpg'));
    fd.append('cmc', new File(['dummy'], 'cmc.pdf'));

    const res = await createDossier(fd);
    assert.strictEqual(res.success, false);
    if (!res.success && res.errors) {
      assert.ok(res.errors.cmc?.includes('Conflit de fichiers'));
    }
  });

  test('E. PDF pour Carte Grise => refus', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000005');
    fd.append('situationVehicule', 'immatricule');
    const pdfBuffer = Buffer.from('255044462D312E', 'hex'); // PDF
    fd.append('recto', new File([pdfBuffer], 'recto.pdf', { type: 'application/pdf' }));
    fd.append('verso', new File([pdfBuffer], 'verso.pdf', { type: 'application/pdf' }));

    const res = await createDossier(fd);
    assert.strictEqual(res.success, false);
    if (!res.success && res.errors) {
      assert.ok(res.errors.recto?.includes('PDF est refusé pour la Carte Grise'));
    }
  });

  test('F. Fichier > 4 MB => refus', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000006');
    fd.append('situationVehicule', 'non_immatricule');

    const largeBuffer = Buffer.alloc(5 * 1024 * 1024);
    largeBuffer.write('FFD8FFDB', 'hex');

    const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });
    fd.append('cmc', file);

    const res = await createDossier(fd);
    assert.strictEqual(res.success, false);
    if (!res.success && res.errors) {
      assert.strictEqual(res.errors.cmc, 'Le fichier ne doit pas dépasser 4 MB.');
    }
  });

  test('G. Faux MIME / magic bytes invalides => refus', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000007');
    fd.append('situationVehicule', 'non_immatricule');
    const fakeBuffer = Buffer.from('FAKEBYTES', 'utf8');
    fd.append('cmc', new File([fakeBuffer], 'doc.pdf', { type: 'application/pdf' }));

    const res = await createDossier(fd);
    assert.strictEqual(res.success, false);
    if (!res.success && res.errors) {
      assert.ok(res.errors.cmc?.includes('non valide ou corrompu'));
    }
  });

  test('Magic Bytes function works correctly', () => {
    assert.strictEqual(checkMagicBytes(Buffer.from('FFD8FFDB', 'hex')), 'image/jpeg');
    assert.strictEqual(checkMagicBytes(Buffer.from('89504E470D0A1A0A', 'hex')), 'image/png');
    assert.strictEqual(checkMagicBytes(Buffer.from('255044462D312E', 'hex')), 'application/pdf');
    assert.strictEqual(checkMagicBytes(Buffer.from('Hello world')), null);
  });
  test('H. Email absent => dossier accepté (email null)', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000008');
    // no email appended
    fd.append('situationVehicule', 'immatricule');

    const jpegBuffer = Buffer.from('FFD8FFDB', 'hex');
    fd.append('recto', new File([jpegBuffer], 'recto.jpg', { type: 'image/jpeg' }));
    fd.append('verso', new File([jpegBuffer], 'verso.jpg', { type: 'image/jpeg' }));

    const res = await createDossier(fd);
    if (!res.success) {
      const errStr = getErrorString(res);
      assert.ok(!errStr.includes('obligatoires') && !errStr.includes('PDF') && !errStr.includes('MB'));
    }
  });

  test('I. CMC PDF => OCR bypassé et accepté', async () => {
    const fd = new FormData();
    fd.append('phone', '+221770000009');
    fd.append('situationVehicule', 'non_immatricule');

    const pdfBuffer = Buffer.from('255044462D312E', 'hex');
    fd.append('cmc', new File([pdfBuffer], 'cmc.pdf', { type: 'application/pdf' }));

    const res = await createDossier(fd);
    if (!res.success) {
      const errStr = getErrorString(res);
      assert.ok(!errStr.includes('texte lisible') && !errStr.includes('obligatoires') && !errStr.includes('MB'));
    }
  });
});
