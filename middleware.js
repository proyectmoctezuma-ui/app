
import { NextResponse } from 'next/server';

const protectedRoutes = ['/admin']; 
const publicRoutes = ['/', '/login', '/register']; 

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('session')?.value;

  // 1. Si el usuario no está autenticado y trata de acceder a una ruta protegida
  if (!session && protectedRoutes.some(prefix => pathname.startsWith(prefix))) {
    const absoluteURL = new URL('/login', request.nextUrl.origin);
    return NextResponse.redirect(absoluteURL.toString());
  }

  // 2. Si el usuario YA está autenticado y trata de acceder a login/register
  if (session && (pathname === '/login' || pathname === '/register')) {
    const absoluteURL = new URL('/admin', request.nextUrl.origin);
    return NextResponse.redirect(absoluteURL.toString());
  }

  // 3. Si no se cumple ninguna de las condiciones anteriores, dejamos pasar.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - moctezuma_logo.svg (logo file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|moctezuma_logo.svg).*)',
  ],
}
