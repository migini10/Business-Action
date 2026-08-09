import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  if (url.pathname.startsWith('/admin')) {
    const host = req.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    if (process.env.NODE_ENV === 'development' && isLocalhost) {
      return NextResponse.next();
    }
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      const validUser = process.env.ADMIN_USER || 'admin';
      const validPass = process.env.ADMIN_PASSWORD || 'bizness2026';

      if (user === validUser && pwd === validPass) {
        return NextResponse.next();
      }
    }

    url.pathname = '/api/auth';
    return new NextResponse('Accès refusé', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Espace Admin Bizness Action"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
