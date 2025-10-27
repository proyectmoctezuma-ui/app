// app/api/scores/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

async function getUidFromSessionCookie() {
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const uid = await getUidFromSessionCookie();
    if (!uid) return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 200 });

    const body = await req.json().catch(() => ({}));
    const gameId = Number(body?.gameId);
    const gameTitle = String(body?.gameTitle || '').slice(0, 200);
    const score = Number(body?.score);
    if (!Number.isFinite(gameId) || !Number.isFinite(score)) {
      return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
    }

    const docRef = adminDb.collection('users').doc(uid).collection('scores').doc(String(gameId));
    await docRef.set({
      gameId,
      gameTitle,
      score,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[scores:POST]', e?.code || e?.message || e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const uid = await getUidFromSessionCookie();
    if (!uid) return NextResponse.json({ ok: false, scores: {} }, { status: 200 });

    const snap = await adminDb.collection('users').doc(uid).collection('scores').get();
    const scores = {};
    snap.forEach(d => { scores[d.id] = d.data(); });

    return NextResponse.json({ ok: true, scores });
  } catch (e) {
    console.error('[scores:GET]', e?.code || e?.message || e);
    return NextResponse.json({ ok: false, scores: {} }, { status: 200 });
  }
}
