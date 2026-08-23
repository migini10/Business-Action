import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('AdminDashboard PDF Preview', async (t) => {
  const adminDashboardPath = path.join(process.cwd(), 'src/app/admin/AdminDashboard.tsx');
  const code = fs.readFileSync(adminDashboardPath, 'utf8');

  // Extract the renderFilePreview function content for easier matching
  const renderPreviewMatch = code.match(/const renderFilePreview =[\s\S]*?};/);
  assert.ok(renderPreviewMatch, 'renderFilePreview function should exist');
  const renderPreviewCode = renderPreviewMatch[0];

  await t.test('PDF utilise un rendu object interne', () => {
    assert.match(renderPreviewCode, /<object data=\{`\$\{url\}#toolbar=0&navpanes=0&scrollbar=0`\} type="application\/pdf"/);
    assert.match(renderPreviewCode, /pointerEvents:\s*'none'/);
  });

  await t.test('PDF ne passe jamais dans <img> et image/jpeg reste inchangée', () => {
    // Check that we differentiate PDF vs Image correctly
    assert.match(renderPreviewCode, /isPdfDocument \?/);
    assert.match(renderPreviewCode, /<img src=\{url\}/);
    // Ensure image uses objectFit: contain, and PDF does not use objectFit: cover
    assert.match(renderPreviewCode, /objectFit:\s*'contain'/);
    assert.doesNotMatch(renderPreviewCode, /objectFit:\s*'cover'/);
  });

  await t.test('overlay ouvre DocumentViewerModal et pas de target="_blank"', () => {
    // Check for the transparent button overlay
    assert.match(renderPreviewCode, /<button[^>]*onClick=\{\(\) => setViewerDoc\(\{ url, title: label, mimeType: docObj\?\.mimeType \}\)\}[^>]*style=\{\{[^}]*position:\s*'absolute'[^}]*inset:\s*0[^}]*zIndex:\s*10/);
    assert.doesNotMatch(renderPreviewCode, /target="_blank"/);
    assert.doesNotMatch(renderPreviewCode, /window\.open/);
  });

  await t.test('fallback PDF présent dans le render', () => {
    // The fallback is inside the <object> or rendered alongside
    assert.match(renderPreviewCode, /Document PDF/);
    assert.match(renderPreviewCode, /Cliquer pour ouvrir/);
  });
});
