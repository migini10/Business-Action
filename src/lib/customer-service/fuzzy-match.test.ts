import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectIntent } from './intent';
import { isFuzzyMatch, damerauLevenshteinDistance } from './fuzzy-match';
import { parseVehicleSelection, parseConfirmSelection } from './quote-state';

describe('Customer Service Auto - Fuzzy Match (CUSTOMER-SERVICE-AUTO-003.1)', () => {

  describe('Damerau-Levenshtein & Basic Fuzzy', () => {
    it('calculates correct distances', () => {
      assert.strictEqual(damerauLevenshteinDistance('quote', 'qoute'), 1, 'Transposition should cost 1');
      assert.strictEqual(damerauLevenshteinDistance('devis', 'devi'), 1, 'Deletion should cost 1');
      assert.strictEqual(damerauLevenshteinDistance('service', 'servise'), 1, 'Substitution should cost 1');
      assert.strictEqual(damerauLevenshteinDistance('agent', 'argent'), 1, 'Insertion should cost 1');
    });

    it('rejects forbidden matches safely', () => {
      assert.strictEqual(isFuzzyMatch('argent', 'agent'), false, 'argent must not match agent');
      assert.strictEqual(isFuzzyMatch('chat', 'quote'), false, 'chat must not match quote');
      assert.strictEqual(isFuzzyMatch('prix', 'devis'), false, 'prix must not match devis directly');
    });

    it('applies correct thresholds by length', () => {
      assert.strictEqual(isFuzzyMatch('beg', 'begg'), true, 'length 4, dist 1 -> ok');
      assert.strictEqual(isFuzzyMatch('ve', 'veux'), false, 'length 4, dist 2 -> reject');
    });
  });

  describe('Intent Resolution with Typos - FR', () => {
    it('detects QUOTE_REQUEST with typos', () => {
      assert.strictEqual(detectIntent('je veux un devi'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('je ve un devis'), 'QUOTE_REQUEST');
    });

    it('detects FAQ_QUOTE with typos', () => {
      assert.strictEqual(detectIntent('coment demander un devis'), 'FAQ_QUOTE');
    });

    it('detects FAQ_SERVICES with typos', () => {
      assert.strictEqual(detectIntent('quel servise proposez vous'), 'FAQ_SERVICES');
    });

    it('detects HUMAN_SUPPORT with typos', () => {
      assert.strictEqual(detectIntent('je veu parler a un conseller'), 'HUMAN_SUPPORT');
    });
  });

  describe('Intent Resolution with Typos - WO', () => {
    it('detects QUOTE_REQUEST with typos', () => {
      assert.strictEqual(detectIntent('dama beg devis'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('dama beug devis'), 'QUOTE_REQUEST');
    });

    it('detects FAQ_SERVICES with typos', () => {
      assert.strictEqual(detectIntent('ban servis ngeen di def'), 'FAQ_SERVICES');
    });

    it('handles special characters normalization', () => {
      assert.strictEqual(detectIntent('naka laay def'), 'FAQ_SERVICES');
      assert.strictEqual(detectIntent('wax ak nit'), 'UNKNOWN');
    });
  });

  describe('Intent Resolution with Typos - EN', () => {
    it('detects QUOTE_REQUEST with typos', () => {
      assert.strictEqual(detectIntent('i ned a quote'), 'QUOTE_REQUEST');
      assert.strictEqual(detectIntent('i want a qoute'), 'QUOTE_REQUEST');
    });

    it('detects FAQ_QUOTE with typos', () => {
      assert.strictEqual(detectIntent('how can i requst a quote'), 'FAQ_QUOTE');
    });

    it('detects HUMAN_SUPPORT with typos', () => {
      assert.strictEqual(detectIntent('talk to an advsor'), 'HUMAN_SUPPORT');
    });

    it('detects FAQ_SERVICES with typos', () => {
      assert.strictEqual(detectIntent('what servces do you offer'), 'FAQ_SERVICES');
    });
  });

  describe('Negative tests (Safety against false positives)', () => {
    it('keeps irrelevant messages as UNKNOWN', () => {
      assert.strictEqual(detectIntent('bonjour'), 'UNKNOWN');
      assert.strictEqual(detectIntent('salut'), 'UNKNOWN');
      assert.strictEqual(detectIntent('ok'), 'UNKNOWN');
      assert.strictEqual(detectIntent('merci'), 'UNKNOWN');
      assert.strictEqual(detectIntent('12345'), 'UNKNOWN');
      assert.strictEqual(detectIntent('blablabla'), 'UNKNOWN');
      assert.strictEqual(detectIntent('chat'), 'UNKNOWN');
      assert.strictEqual(detectIntent('argent'), 'UNKNOWN');
      assert.strictEqual(detectIntent('voiture rouge'), 'UNKNOWN');
    });
  });

  describe('Workflow Active (Quote State Parsing)', () => {
    it('parses CONFIRM modifiers with typos', () => {
      assert.strictEqual(parseConfirmSelection('modifer'), 'MODIFY');
      assert.strictEqual(parseConfirmSelection('anuler'), 'CANCEL');
      assert.strictEqual(parseConfirmSelection('recomencer'), 'MODIFY');
      assert.strictEqual(parseConfirmSelection('conseller'), 'HUMAN_SUPPORT');
    });

    it('parses VEHICLE selections with typos', () => {
      assert.strictEqual(parseVehicleSelection('particuler'), 'PARTICULIER');
      assert.strictEqual(parseVehicleSelection('utilitairee'), 'UTILITAIRE');
    });

    it('prioritizes exact numerical choices over fuzzy matching', () => {
      assert.strictEqual(parseConfirmSelection('1'), 'CONFIRM');
      assert.strictEqual(parseConfirmSelection('2'), 'MODIFY');
      assert.strictEqual(parseConfirmSelection('3'), 'CANCEL');
      assert.strictEqual(parseConfirmSelection('4'), 'HUMAN_SUPPORT');

      assert.strictEqual(parseVehicleSelection('1'), 'PARTICULIER');
      assert.strictEqual(parseVehicleSelection('2'), 'UTILITAIRE');
    });
  });

});
