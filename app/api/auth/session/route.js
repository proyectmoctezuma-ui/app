// app/api/auth/session/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from 'lib/firebase-admin';

const adminAuth = getAdminAuth();

// Opción A: usa POST sin body (como ya lo llamas)
export async function POST() {
  try {
    const sessionCookie = cookies().get('__session')?.value || '';
    if (!sessionCookie) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    await adminAuth.verifySessionCookie(sessionCookie, true);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 para flujo simple
  }
}

// (Opcional) Opción B: también soporta GET, por si prefieres fetch GET
export async function GET() {
  try {
    const sessionCookie = cookies().get('__session')?.value || '';
    if (!sessionCookie) return NextResponse.json({ ok: false }, { status: 200 });
    await adminAuth.verifySessionCookie(sessionCookie, true);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
