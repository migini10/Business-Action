// Public Supabase root CA (not a secret) — pinned for strict certificate
// verification against Production. See CLAUDE.md "Database access".
const SUPABASE_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`

export const ALLOWED_SSL_MODES = ['disable', 'require', 'verify-full'] as const
export type DatabaseSslMode = (typeof ALLOWED_SSL_MODES)[number]

export type PoolSslConfig = false | { rejectUnauthorized: boolean; ca?: string }

const SSL_QUERY_PARAMS_TO_STRIP = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'];

// Absent or unrecognized => always verify-full. A typo during DigitalOcean
// setup must fail loud (TLS handshake error) rather than silently weakening
// Production if the same misconfiguration ever reaches a Supabase env.
export function resolveSslMode(raw: string | undefined): DatabaseSslMode {
  const trimmed = (raw || '').trim();
  if ((ALLOWED_SSL_MODES as readonly string[]).includes(trimmed)) {
    return trimmed as DatabaseSslMode;
  }
  if (trimmed) {
    // Non-sensitive: only the mode name itself is logged, never the connection string.
    console.warn(`[database-ssl] Unrecognized DATABASE_RUNTIME_SSL_MODE "${trimmed}" — falling back to verify-full.`);
  }
  return 'verify-full';
}

export function buildSslConfig(mode: DatabaseSslMode): PoolSslConfig {
  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-full':
    default:
      return { ca: SUPABASE_CA, rejectUnauthorized: true };
  }
}

// Removes TLS-related query params from the connection string so a stray
// sslmode=... (or sslcert/sslkey/sslrootcert) embedded in DATABASE_URL can
// never silently override the DATABASE_RUNTIME_SSL_MODE-resolved policy —
// `pg` otherwise merges the URL's own ssl-related params on top of the
// programmatic `ssl` option passed to the Pool constructor.
export function stripSslQueryParams(connectionString: string): string {
  if (!connectionString) return connectionString;
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Not a parseable URL (e.g. empty string) — nothing to strip.
    return connectionString;
  }
  for (const param of SSL_QUERY_PARAMS_TO_STRIP) {
    url.searchParams.delete(param);
  }
  return url.toString();
}

export function resolvePoolSslConfig(connectionString: string, rawMode: string | undefined): {
  connectionString: string;
  ssl: PoolSslConfig;
  mode: DatabaseSslMode;
} {
  const mode = resolveSslMode(rawMode);
  return {
    connectionString: stripSslQueryParams(connectionString),
    ssl: buildSslConfig(mode),
    mode
  };
}
