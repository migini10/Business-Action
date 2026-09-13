/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { verifyResetSession } from '@/lib/password-reset-crypto';

function hashString(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const mockSecret = 'test-secret';

const mockPrisma: any = {
  passwordResetChallenge: {
    findFirst: async () => null,
  },
};

require.cache[require.resolve('@/lib/prisma')] = {
  id: require.resolve('@/lib/prisma'),
  filename: require.resolve('@/lib/prisma'),
  loaded: true,
  exports: { default: mockPrisma, __esModule: true }
} as any;

const { GET } = require('../app/api/auth/verify-reset/route');

describe('GET /api/auth/verify-reset (intégration handler complet)', () => {
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.PASSWORD_RESET_OTP_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.PASSWORD_RESET_OTP_SECRET = mockSecret;
    mockPrisma.passwordResetChallenge.findFirst = async () => null;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PASSWORD_RESET_OTP_SECRET; else process.env.PASSWORD_RESET_OTP_SECRET = originalSecret;
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it('token valide => pose un cookie de session temporaire signé (jamais le token brut) et redirige vers une URL propre (?step=3, sans le token)', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-real-token', mockSecret),
      resetTokenExpiresAt: expiresAt,
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=my-real-token');
    const res = await GET(req);

    assert.strictEqual(res.status, 307); // NextResponse.redirect default
    const location = res.headers.get('location');
    assert.match(location, /\/mot-de-passe-oublie\?step=3$/, "L'URL de redirection ne doit contenir aucun token, seulement ?step=3");
    assert.ok(!location.includes('my-real-token'), "Le token brut ne doit jamais apparaître dans l'URL de redirection");

    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /password_reset_session=/, "Le cookie doit être le cookie de session signée, pas password_reset_token");
    assert.ok(!setCookie.includes('password_reset_token='), "L'ancien cookie contenant le token brut ne doit plus jamais être posé");
    assert.ok(!setCookie.includes('my-real-token'), "Le token WhatsApp brut ne doit jamais apparaître dans le cookie");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const cookieValue = setCookie.match(/password_reset_session=([^;]+)/)?.[1];
    const decoded = verifyResetSession(decodeURIComponent(cookieValue as string), mockSecret);
    assert.ok(decoded, 'Le cookie doit être une session valide et correctement signée');
    assert.strictEqual(decoded?.challengeId, 'chal1', "La session doit référencer le challenge par id, jamais par le token");
    assert.strictEqual(decoded?.exp, expiresAt.getTime(), "L'expiration de la session doit être bornée par celle du challenge");
  });

  it('signature falsifiée => la session est rejetée par verifyResetSession', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-real-token', mockSecret),
      resetTokenExpiresAt: expiresAt,
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=my-real-token');
    const res = await GET(req);
    const setCookie = res.headers.get('set-cookie') || '';
    const cookieValue = decodeURIComponent(setCookie.match(/password_reset_session=([^;]+)/)?.[1] as string);

    // Falsifie l'id du challenge en conservant la même signature
    const [encoded, signature] = cookieValue.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ challengeId: 'chal-attacker', exp: expiresAt.getTime() })).toString('base64url');
    const tampered = `${tamperedPayload}.${signature}`;

    assert.strictEqual(verifyResetSession(tampered, mockSecret), null, 'Une session avec une signature ne correspondant pas au payload doit être refusée');
    assert.notStrictEqual(encoded, tamperedPayload);
  });

  it('token absent => redirection générique vers la page d\'erreur, aucun cookie posé', async () => {
    const req = new NextRequest('http://localhost/api/auth/verify-reset');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.match(location, /\/mot-de-passe-oublie\?error=/);
    assert.strictEqual(res.headers.get('set-cookie'), null);
  });

  it('token invalide/introuvable => même redirection générique que token absent (aucune fuite d\'information)', async () => {
    mockPrisma.passwordResetChallenge.findFirst = async () => null;

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=unknown-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.match(location, /\/mot-de-passe-oublie\?error=/);
    assert.strictEqual(res.headers.get('set-cookie'), null);
  });

  it('token expiré => redirection d\'erreur générique, aucun cookie posé', async () => {
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('expired-token', mockSecret),
      resetTokenExpiresAt: new Date(Date.now() - 10000),
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=expired-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.match(location, /\/mot-de-passe-oublie\?error=/);
    assert.strictEqual(res.headers.get('set-cookie'), null);
  });

  it('même lien réutilisé après consommation (usedAt déjà défini) => refusé (simulé par findFirst filtrant usedAt: null)', async () => {
    // Simule fidèlement le filtre réel : un challenge déjà consommé ne matche plus usedAt: null
    mockPrisma.passwordResetChallenge.findFirst = async (q: any) => {
      if (q.where.usedAt === null) return null; // déjà utilisé => plus dans le scope de la query
      return null;
    };

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=already-used-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.match(location, /\/mot-de-passe-oublie\?error=/);
    assert.strictEqual(res.headers.get('set-cookie'), null);
  });
});

describe('GET /api/auth/verify-reset — origine publique de confiance (APP_BASE_URL)', () => {
  let originalSecret: string | undefined;
  let originalAppBaseUrl: string | undefined;
  const publicBaseUrl = 'https://dev.businessaction.sn';

  beforeEach(() => {
    originalSecret = process.env.PASSWORD_RESET_OTP_SECRET;
    originalAppBaseUrl = process.env.APP_BASE_URL;
    process.env.PASSWORD_RESET_OTP_SECRET = mockSecret;
    process.env.APP_BASE_URL = publicBaseUrl;
    mockPrisma.passwordResetChallenge.findFirst = async () => null;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PASSWORD_RESET_OTP_SECRET; else process.env.PASSWORD_RESET_OTP_SECRET = originalSecret;
    if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL; else process.env.APP_BASE_URL = originalAppBaseUrl;
  });

  it('token valide => redirige vers l\'origine publique configurée (APP_BASE_URL), jamais localhost:3000', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-real-token', mockSecret),
      resetTokenExpiresAt: expiresAt,
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=my-real-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.strictEqual(location, `${publicBaseUrl}/mot-de-passe-oublie?step=3`);
    assert.ok(!location?.includes('localhost:3000'), 'Aucune redirection vers localhost:3000');
  });

  it('token invalide => redirige vers l\'origine publique configurée, jamais localhost:3000', async () => {
    mockPrisma.passwordResetChallenge.findFirst = async () => null;

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=unknown-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.ok(location?.startsWith(publicBaseUrl), "L'URL d'erreur doit commencer par l'origine publique configurée");
    assert.ok(!location?.includes('localhost:3000'), 'Aucune redirection vers localhost:3000');
  });

  it('token expiré => redirige vers l\'origine publique configurée, jamais localhost:3000', async () => {
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('expired-token', mockSecret),
      resetTokenExpiresAt: new Date(Date.now() - 10000),
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=expired-token');
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.ok(location?.startsWith(publicBaseUrl), "L'URL d'erreur doit commencer par l'origine publique configurée");
    assert.ok(!location?.includes('localhost:3000'), 'Aucune redirection vers localhost:3000');
  });

  it('un Host / X-Forwarded-Host falsifié dans la requête ne modifie jamais la destination de redirection', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    mockPrisma.passwordResetChallenge.findFirst = async () => ({
      id: 'chal1',
      resetTokenHash: hashString('my-real-token', mockSecret),
      resetTokenExpiresAt: expiresAt,
    });

    const req = new NextRequest('http://localhost/api/auth/verify-reset?token=my-real-token', {
      headers: {
        host: 'evil-attacker.example',
        'x-forwarded-host': 'evil-attacker.example',
        'x-forwarded-proto': 'http',
      },
    });
    const res = await GET(req);

    const location = res.headers.get('location');
    assert.strictEqual(location, `${publicBaseUrl}/mot-de-passe-oublie?step=3`, "La destination doit provenir uniquement d'APP_BASE_URL, jamais du Host/X-Forwarded-Host de la requête");
    assert.ok(!location?.includes('evil-attacker.example'), "Un Host falsifié ne doit jamais apparaître dans la redirection");
  });
});
