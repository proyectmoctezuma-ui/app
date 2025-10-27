// app/api/auth/session-login/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

async function getProfileStatus(decodedToken) {
  const { uid, email, picture } = decodedToken;
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    // Si el usuario no existe en Firestore, créalo.
    const newUser = {
      email,
      photoURL: picture || '',
      profileComplete: false, // Marcar como incompleto para forzar la redirección
      createdAt: new Date().toISOString(),
    };
    await userRef.set(newUser);
    return 'incomplete-profile';
  }

  const userData = userSnap.data();
  return userData.profileComplete ? 'success' : 'incomplete-profile';
}

export async function POST(req) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: 'Falta idToken' }, { status: 400 });

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (error) {
      console.error('Error al verificar idToken:', error);
      return NextResponse.json({ error: 'idToken inválido' }, { status: 401 });
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 días
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    console.log('[session-login] verified uid:', decodedToken.uid, 'provider:', decodedToken.firebase?.sign_in_provider);

    const status = await getProfileStatus(decodedToken);
    const response = NextResponse.json({ status, sessionCookie }, { status: 200 });
    response.cookies.set('__session', sessionCookie, {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(expiresIn / 1000),
    });

    return response;

  } catch (e) {
    console.error('[session-login fatal]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
