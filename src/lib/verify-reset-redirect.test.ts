import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/verify-reset/route';

describe('verify-reset trusted public URL redirect', () => {
  let prevAppBaseUrl: string | undefined;
  let prevOtpSecret: string | undefined;

  beforeEach(() => {
    prevAppBaseUrl = process.env.APP_BASE_URL;
    prevOtpSecret = process.env.PASSWORD_RESET_OTP_SECRET;
  });

  afterEach(() => {
    if (prevAppBaseUrl !== undefined) {
      process.env.APP_BASE_URL = prevAppBaseUrl;
    } else {
      delete process.env.APP_BASE_URL;
    }
    if (prevOtpSecret !== undefined) {
      process.env.PASSWORD_RESET_OTP_SECRET = prevOtpSecret;
    } else {
      delete process.env.PASSWORD_RESET_OTP_SECRET;
    }
  });

  describe('base URL fallback behavior', () => {
    it('redirects to APP_BASE_URL when configured', async () => {
      process.env.APP_BASE_URL = 'https://dev.businessaction.sn';
      const req = new NextRequest('http://internal-host:3000/api/auth/verify-reset');
      const res = await GET(req);
      const location = res.headers.get('location')!;
      assert.strictEqual(new URL(location).origin, 'https://dev.businessaction.sn');
    });

    it('falls back to http://localhost:3000 when APP_BASE_URL is not set', async () => {
      delete process.env.APP_BASE_URL;
      const req = new NextRequest('http://spoofed-domain.com:8080/api/auth/verify-reset');
      const res = await GET(req);
      const location = res.headers.get('location')!;
      assert.strictEqual(new URL(location).origin, 'http://localhost:3000');
    });

    it('falls back to http://localhost:3000 when APP_BASE_URL is empty', async () => {
      process.env.APP_BASE_URL = '';
      const req = new NextRequest('http://spoofed-domain.com:8080/api/auth/verify-reset');
      const res = await GET(req);
      const location = res.headers.get('location')!;
      assert.strictEqual(new URL(location).origin, 'http://localhost:3000');
    });
  });

  describe('GET redirect security against localhost / Host spoofing', () => {
    it('redirects error to APP_BASE_URL and ignores request.url or malicious Host header when token is missing', async () => {
      process.env.APP_BASE_URL = 'https://dev.businessaction.sn';

      const req = new NextRequest('http://127.0.0.1:3016/api/auth/verify-reset', {
        headers: {
          host: 'evil-attacker.com',
          'x-forwarded-host': 'attacker.org',
        },
      });

      const res = await GET(req);

      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location, 'Location header must be present');
      assert.ok(location.startsWith('https://dev.businessaction.sn/mot-de-passe-oublie?error='), `Location was: ${location}`);
      assert.ok(!location.includes('localhost'), 'Location must not contain localhost');
      assert.ok(!location.includes('127.0.0.1'), 'Location must not contain 127.0.0.1');
      assert.ok(!location.includes('evil-attacker.com'), 'Location must not contain Host header');
      assert.ok(!location.includes('attacker.org'), 'Location must not contain X-Forwarded-Host header');
    });

    it('redirects error to APP_BASE_URL when challenge is not found in database', async () => {
      process.env.APP_BASE_URL = 'https://dev.businessaction.sn';
      process.env.PASSWORD_RESET_OTP_SECRET = 'unit-test-secret-at-least-32-chars-long!';

      const req = new NextRequest('http://internal-docker-upstream:3016/api/auth/verify-reset?token=nonexistent123', {
        headers: {
          host: 'attacker.org',
        },
      });

      const res = await GET(req);

      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location, 'Location header must be present');
      assert.ok(location.startsWith('https://dev.businessaction.sn/mot-de-passe-oublie?error='), `Location was: ${location}`);
      assert.ok(!location.includes('internal-docker-upstream'), 'Location must not contain internal host');
      assert.ok(!location.includes('attacker.org'), 'Location must not contain attacker host');
    });

    it('ensures all redirects share the exact same trusted base origin', async () => {
      process.env.APP_BASE_URL = 'https://dev.businessaction.sn';

      const errorReq1 = new NextRequest('http://127.0.0.1:3000/api/auth/verify-reset');
      const errorRes1 = await GET(errorReq1);
      const url1 = new URL(errorRes1.headers.get('location')!);

      const errorReq2 = new NextRequest('http://localhost:3016/api/auth/verify-reset?token=wrong');
      const errorRes2 = await GET(errorReq2);
      const url2 = new URL(errorRes2.headers.get('location')!);

      assert.strictEqual(url1.origin, 'https://dev.businessaction.sn');
      assert.strictEqual(url2.origin, 'https://dev.businessaction.sn');
      assert.strictEqual(url1.origin, url2.origin);
    });
  });
});
