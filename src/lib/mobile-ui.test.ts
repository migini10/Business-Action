import test from 'node:test';
import assert from 'node:assert';
import { getAccueilHref, getSidebarClasses, getWhatsappGridClasses, shouldAutoScroll } from './mobile-ui';

test('MOBILE-UI-001: Contextual Navigation Destinations', () => {
  assert.strictEqual(getAccueilHref('/espace-client/dashboard'), '/espace-client', 'Client space redirects to /espace-client');
  assert.strictEqual(getAccueilHref('/admin/dashboard'), '/admin', 'Admin space returns /admin');
  assert.strictEqual(getAccueilHref('/demande-devis'), '/', 'Public space redirects to /');
});

test('MOBILE-UI-001: Drawer State Classes', () => {
  assert.strictEqual(getSidebarClasses(false), 'admin-sidebar', 'Drawer closed');
  assert.strictEqual(getSidebarClasses(true), 'admin-sidebar open', 'Drawer open');
});

test('MOBILE-UI-001: WhatsApp Grid Classes', () => {
  assert.strictEqual(getWhatsappGridClasses(false), 'whatsapp-grid', 'No conversation selected');
  assert.strictEqual(getWhatsappGridClasses(true), 'whatsapp-grid has-conv', 'Conversation selected');
});

test('MOBILE-UI-001: Scroll Logic', () => {
  assert.strictEqual(shouldAutoScroll(850, 1000, 100), true, 'Should auto-scroll when within 150px of bottom');
  assert.strictEqual(shouldAutoScroll(500, 1000, 100), false, 'Should NOT auto-scroll when far from bottom');
});
