// app/api/debug/firestore/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAdminDb } from 'lib/firebase-admin';

const adminDb = getAdminDb();

export async function GET() {
  try {
    // Opción A: auto-ID
    const col = adminDb.collection('debug');
    const writeRes = await col.add({ ping: new Date().toISOString() });
    const snap = await writeRes.get();

    return NextResponse.json({
      ok: true,
      id: writeRes.id,
      data: snap.data(),
    });
  } catch (e) {
    console.error('[DEBUG FIRESTORE]', e?.code, e?.message);
    return NextResponse.json(
      { ok: false, code: e?.code, message: e?.message || 'unknown' },
      { status: 500 }
    );
  }
}
