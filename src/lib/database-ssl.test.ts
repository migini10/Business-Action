import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveSslMode, buildSslConfig, stripSslQueryParams, resolvePoolSslConfig } from '@/lib/database-ssl';

describe('database-ssl: resolveSslMode', () => {
  it('mode absent => verify-full', () => {
    assert.strictEqual(resolveSslMode(undefined), 'verify-full');
    assert.strictEqual(resolveSslMode(''), 'verify-full');
  });

  it('mode invalide => verify-full (fail-closed, never silently permissive)', () => {
    assert.strictEqual(resolveSslMode('disble'), 'verify-full');
    assert.strictEqual(resolveSslMode('DISABLE'), 'verify-full'); // case-sensitive on purpose, no fuzzy matching
    assert.strictEqual(resolveSslMode('none'), 'verify-full');
  });

  it('accepts the 3 documented values verbatim', () => {
    assert.strictEqual(resolveSslMode('disable'), 'disable');
    assert.strictEqual(resolveSslMode('require'), 'require');
    assert.strictEqual(resolveSslMode('verify-full'), 'verify-full');
  });
});

describe('database-ssl: buildSslConfig', () => {
  it('disable => ssl false (no TLS at all)', () => {
    assert.strictEqual(buildSslConfig('disable'), false);
  });

  it('require => TLS sans validation de certificat', () => {
    assert.deepStrictEqual(buildSslConfig('require'), { rejectUnauthorized: false });
  });

  it('verify-full => CA Supabase + rejectUnauthorized true', () => {
    const config = buildSslConfig('verify-full');
    assert.strictEqual((config as any).rejectUnauthorized, true);
    assert.ok(typeof (config as any).ca === 'string' && (config as any).ca.includes('BEGIN CERTIFICATE'));
  });
});

describe('database-ssl: stripSslQueryParams', () => {
  it('URL contenant sslmode=disable => sslmode supprimé', () => {
    const input = 'postgresql://user:pass@host:5432/db?sslmode=disable';
    const output = stripSslQueryParams(input);
    assert.ok(!output.includes('sslmode'), `expected sslmode to be stripped, got: ${output}`);
  });

  it('sslcert/sslkey/sslrootcert supprimés', () => {
    const input = 'postgresql://user:pass@host:5432/db?sslcert=/a&sslkey=/b&sslrootcert=/c';
    const output = stripSslQueryParams(input);
    assert.ok(!output.includes('sslcert'));
    assert.ok(!output.includes('sslkey'));
    assert.ok(!output.includes('sslrootcert'));
  });

  it('autres query params conservés', () => {
    const input = 'postgresql://user:pass@host:6543/db?pgbouncer=true&sslmode=require&connection_limit=5';
    const output = stripSslQueryParams(input);
    const parsed = new URL(output);
    assert.strictEqual(parsed.searchParams.get('pgbouncer'), 'true');
    assert.strictEqual(parsed.searchParams.get('connection_limit'), '5');
    assert.strictEqual(parsed.searchParams.get('sslmode'), null);
  });

  it('empty string is returned as-is (nothing to strip)', () => {
    assert.strictEqual(stripSslQueryParams(''), '');
  });
});

describe('database-ssl: resolvePoolSslConfig (integration of the two above)', () => {
  it('URL contenant sslmode=disable + mode verify-full => la policy verify-full est appliquée ET sslmode est retiré de la connection string', () => {
    const input = 'postgresql://user:pass@host:5432/db?sslmode=disable';
    const result = resolvePoolSslConfig(input, 'verify-full');

    assert.strictEqual(result.mode, 'verify-full');
    assert.strictEqual((result.ssl as any).rejectUnauthorized, true);
    assert.ok(typeof (result.ssl as any).ca === 'string');
    assert.ok(!result.connectionString.includes('sslmode'), 'the URL-embedded sslmode must never be able to override the resolved policy');
  });

  it('DigitalOcean: mode disable => ssl false et connection string nettoyée', () => {
    const input = 'postgresql://user:pass@localhost:5432/db?sslmode=disable';
    const result = resolvePoolSslConfig(input, 'disable');

    assert.strictEqual(result.mode, 'disable');
    assert.strictEqual(result.ssl, false);
    assert.ok(!result.connectionString.includes('sslmode'));
  });
});
