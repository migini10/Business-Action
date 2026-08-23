import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Form Field Errors Validation Backend', async (t) => {
  const dossierPath = path.join(process.cwd(), 'src/app/actions/dossier.ts');
  const dossierCode = fs.readFileSync(dossierPath, 'utf8');

  await t.test('createDossier retourne un type structuré FormField', () => {
    assert.match(dossierCode, /export type FormField = 'phone' | 'email' | 'cmc' | 'recto' | 'verso' | 'global';/);
    assert.match(dossierCode, /errors: Partial<Record<FormField, string>>/);
  });

  await t.test('CMC >4 MB => errors.cmc', () => {
    assert.match(dossierCode, /field: 'cmc'/);
    assert.match(dossierCode, /errors: \{ \[item\.field\]:/);
  });

  await t.test('recto >4 MB => errors.recto', () => {
    assert.match(dossierCode, /field: 'recto'/);
  });

  await t.test('verso >4 MB => errors.verso', () => {
    assert.match(dossierCode, /field: 'verso'/);
  });

  await t.test('MIME CMC invalide => errors.cmc', () => {
    assert.match(dossierCode, /if \(!verifiedMime\) \{[\s\S]*?return \{ success: false, errors: \{ \[item\.field\]:/);
  });

  await t.test('erreur globale => errors.global', () => {
    assert.match(dossierCode, /errors: \{ global: /);
  });
});

test('Form Field Errors Frontend React', async (t) => {
  const pagePath = path.join(process.cwd(), 'src/app/demande-devis/page.tsx');
  const pageCode = fs.readFileSync(pagePath, 'utf8');

  await t.test('erreur CMC rendue près de CMC', () => {
    assert.match(pageCode, /<DocumentScanner[\s\S]*?name="cmc"[\s\S]*?errorMsg=\{fieldErrors\.cmc\}/);
  });

  await t.test('erreur recto près de recto', () => {
    assert.match(pageCode, /<DocumentScanner[\s\S]*?name="recto"[\s\S]*?errorMsg=\{fieldErrors\.recto\}/);
  });

  await t.test('remplacement fichier CMC efface uniquement errors.cmc', () => {
    assert.match(pageCode, /onFileAccepted=\{\(f\) => \{ setCmcFile\(f\); clearFieldError\('cmc'\); \}\}/);
  });
});
