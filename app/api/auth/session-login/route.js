
import { NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

// Esta API unificada maneja la creación de la sesión para CUALQUIER método de inicio de sesión
export async function POST(request) {
  try {
    const { idToken } = await request.json();

    // 5 días de duración para la sesión
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const adminAuth = getAdminAuth();
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ status: 'success' }, { status: 200 });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true, // La cookie no es accesible desde el JavaScript del cliente
      secure: process.env.NODE_ENV === 'production', // Solo se envía sobre HTTPS en producción
      maxAge: expiresIn, // Tiempo de vida de la cookie
      path: '/', // Disponible en toda la aplicación
      sameSite: 'lax', // Protección contra ataques CSRF
    });

    return response;
  } catch (error) {
    console.error('Error al crear la cookie de sesión:', error);
    return NextResponse.json({ status: 'error', message: 'No se pudo crear la sesión.' }, { status: 401 });
  }
}
