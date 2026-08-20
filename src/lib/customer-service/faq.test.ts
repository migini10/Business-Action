import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getFaqResponse } from './knowledge/faq';
import { detectIntent } from './intent';

describe('Customer Service Auto - FAQ (CUSTOMER-SERVICE-AUTO-003)', () => {

  describe('Intent Resolution', () => {
    it('FR - FAQ_SERVICES', () => {
      assert.strictEqual(detectIntent('quels sont vos services'), 'FAQ_SERVICES');
    });
    it('FR - FAQ_QUOTE', () => {
      assert.strictEqual(detectIntent('comment faire un devis'), 'FAQ_QUOTE');
    });
    it('FR - QUOTE_REQUEST', () => {
      assert.strictEqual(detectIntent('je veux un devis'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('commencer'), 'QUOTE_REQUEST');
    });
    it('WO - QUOTE_REQUEST', () => {
      assert.strictEqual(detectIntent('dama bëgg devis'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('tambali'), 'QUOTE_REQUEST');
    });
    it('EN - QUOTE_REQUEST', () => {
      assert.strictEqual(detectIntent('i need a quote'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('start'), 'QUOTE_REQUEST');
    });
  });

  describe('FAQ Content Safety', () => {
    it('FR - Services lists correct enum values without hallucinating', () => {
      const resp = getFaqResponse('fr', 'FAQ_SERVICES');
      assert.ok(resp?.includes('Véhicule particulier'));
      assert.ok(resp?.includes('Utilitaire'));
      assert.ok(resp?.includes('Poids lourd'));
      assert.ok(resp?.includes('Deux roues'));
      assert.ok(!resp?.includes('prix')); // no price hallucinations
    });

    it('EN - Quote FAQ instructs user without starting flow', () => {
      const resp = getFaqResponse('en', 'FAQ_QUOTE');
      assert.ok(resp?.includes('Type "Start" to begin'));
    });

    it('WO - Request Status refuses real status and proposes human', () => {
      const resp = getFaqResponse('wo', 'REQUEST_STATUS');
      assert.ok(resp?.includes('Mënuma xool fan la sa mbir tollu'));
      assert.ok(resp?.includes('Conseiller'));
    });

    it('FR - Unknown asks for reformulation or human', () => {
      const resp = getFaqResponse('fr', 'UNKNOWN');
      assert.ok(resp?.includes('pas suffisamment d\'informations'));
      assert.ok(resp?.includes('Conseiller'));
    });
  });
});
