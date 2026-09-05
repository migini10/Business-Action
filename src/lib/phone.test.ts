import { test, describe } from 'node:test';
import assert from 'node:assert';
import { normalizePhoneCanonical } from './phone';

describe('Phone Normalization with libphonenumber-js', () => {
  test('should normalize 9 digits correctly (SN default)', () => {
    assert.strictEqual(normalizePhoneCanonical('771234567'), '+221771234567');
    assert.strictEqual(normalizePhoneCanonical('78 123 45 67'), '+221781234567');
  });

  test('should normalize 10 digits starting with 0 (SN default)', () => {
    assert.strictEqual(normalizePhoneCanonical('0771234567'), '+221771234567');
    assert.strictEqual(normalizePhoneCanonical('077 123 45 67'), '+221771234567');
  });

  test('should normalize international formats starting with +221', () => {
    assert.strictEqual(normalizePhoneCanonical('+221771234567'), '+221771234567');
    assert.strictEqual(normalizePhoneCanonical('+221 77 123 45 67'), '+221771234567');
  });

  test('should normalize international formats starting with 00221', () => {
    assert.strictEqual(normalizePhoneCanonical('00221771234567'), '+221771234567');
    assert.strictEqual(normalizePhoneCanonical('00221 77 123 45 67'), '+221771234567');
  });

  test('should normalize raw 221 formats (WhatsApp style)', () => {
    assert.strictEqual(normalizePhoneCanonical('221771234567'), '+221771234567');
  });

  test('should normalize France number starting with +33', () => {
    assert.strictEqual(normalizePhoneCanonical('+33612345678'), '+33612345678');
  });

  test('should normalize France number with FR default', () => {
    assert.strictEqual(normalizePhoneCanonical('0612345678', 'FR'), '+33612345678');
  });

  test('should normalize Côte d\'Ivoire number (+225)', () => {
    assert.strictEqual(normalizePhoneCanonical('+2250102030405'), '+2250102030405');
  });

  test('should normalize USA number (+1)', () => {
    assert.strictEqual(normalizePhoneCanonical('+12025550174'), '+12025550174');
  });

  test('should return null for invalid formats', () => {
    assert.strictEqual(normalizePhoneCanonical('123'), null);
    assert.strictEqual(normalizePhoneCanonical('abcd'), null);
    assert.strictEqual(normalizePhoneCanonical(''), null);
    assert.strictEqual(normalizePhoneCanonical('+33612345'), null); // too short for France
  });
});

