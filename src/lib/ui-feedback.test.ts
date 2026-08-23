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
