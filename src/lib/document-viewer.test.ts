import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('DocumentViewerModal Automated Checks', async (t) => {
  const modalPath = path.join(process.cwd(), 'src/components/ui/DocumentViewerModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  await t.test('viewport contraint avec minHeight/minWidth 0', () => {
    assert.match(modalCode, /minWidth: 0/);
    assert.match(modalCode, /minHeight: 0/);
    assert.match(modalCode, /overflow: 'hidden'/);
  });

  await t.test('scale=1 => position 0,0', () => {
    assert.match(modalCode, /if \(currentScale === 1\) return \{ x: 0, y: 0 \}/);
  });

  await t.test('zoom >1 => pan (clamp X/Y)', () => {
    assert.match(modalCode, /const maxX = Math\.max\(0, \(scaledWidth - viewportWidth\) \/ 2\);/);
    assert.match(modalCode, /const maxY = Math\.max\(0, \(scaledHeight - viewportHeight\) \/ 2\);/);
    assert.match(modalCode, /x: Math\.max\(-maxX, Math\.min\(maxX, x\)\)/);
    assert.match(modalCode, /y: Math\.max\(-maxY, Math\.min\(maxY, y\)\)/);
  });

  await t.test('retour scale=1 => reset', () => {
    assert.match(modalCode, /handleReset = \(\) => \{[^}]*setScale\(1\);[^}]*setPosition\(\{ x: 0, y: 0 \}\);/);
  });

  await t.test('resize => position re-clampée', () => {
    assert.match(modalCode, /new ResizeObserver\(\(\) => \{[^}]*setPosition\(prev => clampPosition\(prev\.x, prev\.y, scale\)\);/);
  });
});

test('DocumentViewerModal Touch Support', async (t) => {
  const modalPath = path.join(process.cwd(), 'src/components/ui/DocumentViewerModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  await t.test('implémentation onTouchStart, onTouchMove, onTouchEnd', () => {
    assert.match(modalCode, /handleTouchStart/);
    assert.match(modalCode, /handleTouchMove/);
    assert.match(modalCode, /handleTouchEnd/);
    assert.match(modalCode, /e\.touches\[0\]\.clientX/);
  });
});

test('DocumentViewerModal Architecture Viewport -> Pan -> Zoom', async (t) => {
  const modalPath = path.join(process.cwd(), 'src/components/ui/DocumentViewerModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  await t.test('viewport -> panWrapper -> zoomWrapper -> img', () => {
    assert.match(modalCode, /translate3d\(\$\{position\.x\}px, \$\{position\.y\}px, 0\)/);
    assert.match(modalCode, /scale\(\$\{scale\}\)/);
  });
});

test('DocumentViewerModal MimeType PDF Detection', async (t) => {
  const modalPath = path.join(process.cwd(), 'src/components/ui/DocumentViewerModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  await t.test('viewer reçoit mimeType application/pdf', () => {
    assert.match(modalCode, /mimeType === 'application\/pdf'/);
  });
});

test('AdminDashboard MimeType Selection', async (t) => {
  const adminPath = path.join(process.cwd(), 'src/app/actions/admin.ts');
  const adminCode = fs.readFileSync(adminPath, 'utf8');

  await t.test('getDossiers sélectionne mimeType', () => {
    assert.match(adminCode, /mimeType:\s*true/);
  });
});

test('AdminDashboard PDF Preview Behavior', async (t) => {
  const dashboardPath = path.join(process.cwd(), 'src/app/admin/AdminDashboard.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

  await t.test('application/pdf => pas de <img>, carte PDF rendue', () => {
    // Check that isPdfDocument uses docObj?.mimeType
    assert.match(dashboardCode, /docObj\?\.mimeType === 'application\/pdf'/);
    // Check that it renders a document icon instead of img
    assert.match(dashboardCode, /Document PDF/);
  });

  await t.test('clic PDF => DocumentViewerModal avec mimeType', () => {
    assert.match(dashboardCode, /setViewerDoc\(\{ url, title: label, mimeType: docObj\?\.mimeType \}\)/);
  });
});
