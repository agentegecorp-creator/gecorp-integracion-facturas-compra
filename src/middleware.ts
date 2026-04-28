import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { appConfig } from '@/config/app';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(appConfig.sessionCookieName)?.value;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isApiPath = pathname.startsWith('/api');
  const isAssetPath = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (isApiPath || isAssetPath) {
    return NextResponse.next();
  }

  if (!sessionToken && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionToken && isPublicPath) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
