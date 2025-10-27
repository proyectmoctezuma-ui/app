export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

export async function POST(req) {
  try {
    const { name, role } = await req.json();

    // Verifica cookie de sesión
    const sessionCookie = cookies().get('__session')?.value || '';
    if (!sessionCookie) {
      return NextResponse.json({ ok: false, error: 'missing-cookie' }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    // Guarda datos de perfil
    const ref = adminDb.collection('users').doc(uid);
    await ref.set(
      { name, role, profileComplete: true, updatedAt: new Date() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[complete-profile]', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
