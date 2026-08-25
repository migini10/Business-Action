import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // 1. Admin Protection
  if (url.pathname.startsWith('/admin') && url.pathname !== '/admin/login') {
    const adminSessionCookie = req.cookies.get('admin_session');

    if (!adminSessionCookie?.value) {
      const loginUrl = new URL('/admin/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. IP Extraction for /suivi
  const requestHeaders = new Headers(req.headers);
  // Écrase systématiquement le header client
  requestHeaders.delete('x-businessaction-client-ip');

  let trustedIp = null;

  if (process.env.NODE_ENV !== 'production') {
    trustedIp = '127.0.0.1'; // Identité locale stable
  } else {
    // En production Vercel, l'IP client est la première de x-forwarded-for
    const forwardedFor = requestHeaders.get('x-forwarded-for');
    if (forwardedFor) {
      trustedIp = forwardedFor.split(',')[0].trim();
    }
  }

  if (trustedIp) {
    requestHeaders.set('x-businessaction-client-ip', trustedIp);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/admin/:path*', '/suivi', '/suivi/:path*'],
};
