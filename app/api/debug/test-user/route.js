// app/api/debug/test-user/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAdminDb } from 'lib/firebase-admin';

const adminDb = getAdminDb();

export async function GET() {
  try {
    // 🔹 Crea o sobrescribe un documento de prueba
    const ref = adminDb.collection('users').doc('test-user');
    await ref.set({
      ok: true,
      name: 'Test User',
      timestamp: new Date().toISOString(),
    });

    // 🔹 Lee el documento recién escrito
    const snap = await ref.get();
    return NextResponse.json({
      ok: true,
      exists: snap.exists,
      data: snap.data(),
    });
  } catch (err) {
    console.error('[DEBUG TEST-USER]', err);
    return NextResponse.json(
      { ok: false, code: err?.code, message: err?.message },
      { status: 500 }
    );
  }
}
