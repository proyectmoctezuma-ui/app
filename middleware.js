
import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = req.nextUrl.clone();
  const hasSession = req.cookies.get('__session')?.value;

  // Bloquea /admin si NO hay sesión
  if (!hasSession && url.pathname.startsWith('/admin')) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Deja que el cliente decida a dónde ir después de iniciar sesión.
  // La lógica en /login y /register ya maneja la redirección a /admin o /complete-profile.
  // if (hasSession && (url.pathname === '/login' || url.pathname === '/register')) {
  //   url.pathname = '/admin';
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/register'],
};
