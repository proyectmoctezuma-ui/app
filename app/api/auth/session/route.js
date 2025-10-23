import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // Importamos la API de cookies de Next.js
import { adminAuth } from '../../../../lib/firebase-admin';

export async function POST(request) {
  const { idToken } = await request.json();

  if (!idToken) {
    return NextResponse.json({ error: 'No se proporcionó un token de ID.' }, { status: 400 });
  }

  const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 días en milisegundos

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Solo creamos la cookie de sesión si el token es válido
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Usamos la API de cookies de Next.js para establecer las cookies
    cookies().set('session', sessionCookie, {
      httpOnly: true,
      maxAge: expiresIn / 1000,
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    cookies().set('uid', uid, { // También establecemos la cookie de UID
        maxAge: expiresIn / 1000,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Error al crear la cookie de sesión:', error);
    return NextResponse.json({ error: 'No se pudo autenticar.' }, { status: 401 });
  }
}
