import test from 'node:test';
import assert from 'node:assert';
import { validatePasswordPolicy } from './password-policy';

test('Password Policy', async (t) => {
  await t.test('Accepte un mot de passe de 8 caractères', () => {
    const res = validatePasswordPolicy('12345678');
    assert.strictEqual(res.isValid, true);
  });

  await t.test('Accepte un mot de passe long (plus de 8 caractères)', () => {
    const res = validatePasswordPolicy('unMotDePasseTrèsLong123');
    assert.strictEqual(res.isValid, true);
  });

  await t.test('Refuse un mot de passe de 7 caractères', () => {
    const res = validatePasswordPolicy('1234567');
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /8 caractères/);
  });

  await t.test('Refuse un mot de passe vide ou null', () => {
    assert.strictEqual(validatePasswordPolicy('').isValid, false);
    assert.strictEqual(validatePasswordPolicy(null as any).isValid, false);
    assert.strictEqual(validatePasswordPolicy(undefined).isValid, false);
  });

  await t.test('Refuse un mot de passe composé uniquement d\'espaces', () => {
    const res = validatePasswordPolicy('        ');
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /vide/);
  });
});
