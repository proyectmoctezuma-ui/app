import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminAuth, getAdminDb } from '../../../../lib/firebase-admin';

export default async function GameLayout({ children }) {
  // Restringe a una sola partida: si ya hay score del juego 1, redirige a Scores
  try {
    const sessionCookie = cookies().get('__session')?.value || '';
    if (sessionCookie) {
      const adminAuth = getAdminAuth();
      const adminDb = getAdminDb();
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      const uid = decoded?.uid;
      if (uid) {
        const doc = await adminDb
          .collection('users').doc(uid)
          .collection('scores').doc('1')
          .get();
        if (doc.exists) {
          redirect('/admin/scores');
        }
      }
    }
  } catch {}

  return children;
}
