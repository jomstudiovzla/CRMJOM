import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';

export default async function proxy(request) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith('/login');
  const isAuthApi = pathname.startsWith('/api/auth');

  if (isAuthApi) return NextResponse.next();

  const response = NextResponse.next();
  const session = await getIronSession(request, response, sessionOptions);

  if (!session.isLoggedIn && !isLogin) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.isLoggedIn && isLogin) {
    return NextResponse.redirect(new URL('/?tab=company', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};