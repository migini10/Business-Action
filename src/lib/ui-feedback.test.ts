import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('UI Feedback - Phase 1 Admin', async (t) => {
  const adminDashboardPath = path.join(process.cwd(), 'src/app/admin/AdminDashboard.tsx');
  const toastProviderPath = path.join(process.cwd(), 'src/components/ui/ToastProvider.tsx');
  const confirmDialogPath = path.join(process.cwd(), 'src/components/ui/ConfirmDialog.tsx');

  const adminCode = fs.readFileSync(adminDashboardPath, 'utf8');
  const toastCode = fs.readFileSync(toastProviderPath, 'utf8');
  const confirmCode = fs.readFileSync(confirmDialogPath, 'utf8');

  await t.test('ToastProvider - Architecture', () => {
    assert.match(toastCode, /type ToastType = 'success' | 'error' | 'info'/);
    assert.match(toastCode, /setTimeout\(\(\) => \{\s*onRemove\(toast\.id\);\s*\}, 5000\)/, 'auto-dismiss 5 secondes');
    assert.match(toastCode, /aria-live="polite"/, 'aria-live présent');
    assert.match(toastCode, /<ToastContext\.Provider/, 'Provider contextuel');
  });

  await t.test('ConfirmDialog - Architecture', () => {
    assert.match(confirmCode, /createPortal\(/, 'Utilise createPortal');
    assert.match(confirmCode, /e\.key === 'Escape'/, 'Escape => annuler');
    assert.match(confirmCode, /role="dialog"/);
    assert.match(confirmCode, /aria-modal="true"/);
    assert.match(confirmCode, /disabled={loading}/, 'loading empêche double confirmation');
    assert.match(confirmCode, /if \(!loading\) onConfirm\(\)/, 'Loading condition pour onConfirm');
  });

  await t.test('AdminDashboard - Migration native', () => {
    assert.doesNotMatch(adminCode, /window\.confirm\(/, 'aucun window.confirm');
    assert.doesNotMatch(adminCode, /[^a-zA-Z0-9]alert\(/, 'aucun alert(');

    // Status change assertions
    assert.match(adminCode, /setPendingStatusChange\(\{ dossierId: id, oldStatut, newStatut \}\)/, 'sélection statut n\'appelle pas immédiatement mutation');
    assert.match(adminCode, /const confirmStatusChange/, 'confirmStatusChange gère la validation');
    assert.match(adminCode, /setPendingStatusChange\(null\)/, 'cancel conserve ancien statut');

    // Toasts usages
    assert.match(adminCode, /toast\(\{ type: 'error', message: 'Erreur lors de la déconnexion' \}\)/);
    assert.match(adminCode, /toast\(\{ type: 'error', message: "Erreur lors de la mise à jour" \}\)/);
    assert.match(adminCode, /toast\(\{ type: 'error', message: "Le nom et le téléphone sont obligatoires\." \}\)/);
    assert.match(adminCode, /toast\(\{ type: 'error', message: "Erreur lors de l'ajout de la transaction\." \}\)/);
  });
});


test('UI Feedback - Phase 2 Espace Client & Suivi', async (t) => {
  const espaceClientPath = path.join(process.cwd(), 'src/app/espace-client/page.tsx');
  const suiviPath = path.join(process.cwd(), 'src/app/suivi/page.tsx');
  const clientActionsPath = path.join(process.cwd(), 'src/app/actions/client.ts');

  const espaceClientCode = fs.readFileSync(espaceClientPath, 'utf8');
  const suiviCode = fs.readFileSync(suiviPath, 'utf8');
  const clientActionsCode = fs.readFileSync(clientActionsPath, 'utf8');

  await t.test('Client Actions - Data Selection', () => {
    assert.match(clientActionsCode, /mimeType: true/, 'mimeType doit être sélectionné');
  });

  await t.test('Espace Client - Documents & Alertes', () => {
    assert.doesNotMatch(espaceClientCode, /[^a-zA-Z0-9]alert\(/, 'aucun alert()');

    // Check devis (using string includes for simplicity)
    assert.ok(espaceClientCode.includes("setViewerDoc({ url: dossier.devisUrl, title: 'Devis', mimeType: 'application/pdf' })"));
    assert.ok(espaceClientCode.includes("setViewerDoc({ url: selectedDossier.devisUrl, title: 'Devis', mimeType: 'application/pdf' })"));

    // Check recto/verso
    assert.ok(espaceClientCode.includes("setViewerDoc({ url: selectedDossier.rectoUrl, title: 'Carte Grise (Recto)', mimeType: 'image/jpeg' })"));
    assert.ok(espaceClientCode.includes("setViewerDoc({ url: selectedDossier.versoUrl, title: 'Carte Grise (Verso)', mimeType: 'image/jpeg' })"));

    // Check modal usage
    const modalMatches = espaceClientCode.match(/<DocumentViewerModal/g);
    assert.ok(modalMatches && modalMatches.length === 1, 'DocumentViewerModal doit être monté exactement une fois');

    assert.ok(espaceClientCode.includes('setViewerDoc({ url: `/api/documents/${doc.id}`'), "L'URL moderne /api/documents/[id] est conservée");
    assert.doesNotMatch(espaceClientCode, /target="_blank"/, "Aucun target=_blank n'est présent");
    assert.ok(espaceClientCode.includes("open={viewerDoc !== null}"));
  });

  await t.test('Suivi - Documents & Alertes', () => {
    assert.doesNotMatch(suiviCode, /[^a-zA-Z0-9]alert\(/, 'aucun alert()');

    // Check modal usage
    assert.ok(suiviCode.includes("<DocumentViewerModal"));
    assert.ok(suiviCode.includes("open={viewerDoc !== null}"));
  });

  await t.test('Suivi - Cartes Navigables', () => {
    assert.ok(suiviCode.includes("const [selectedDossier, setSelectedDossier] = useState<any>(null)"), "L'état selectedDossier existe");
    assert.ok(suiviCode.includes("onClick={() => setSelectedDossier(dossierData)}"), "Le clic sur la carte sélectionne le dossier");
    assert.ok(suiviCode.includes("onKeyDown="), "La carte est accessible au clavier");
    assert.ok(suiviCode.includes("renderDossierDetail(selectedDossier)"), "Le détail du dossier est affiché s'il est sélectionné");
    assert.doesNotMatch(suiviCode, /href="\/suivi\//, "L'URL ne doit pas changer (pas de route dédiée)");
  });
});
