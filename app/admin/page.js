// app/admin/page.js  (Server Component)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';
import styles from './AdminWelcome.module.css';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

async function getUserData(uid) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (snap.exists) {
    const data = snap.data() || {};
    return {
      name: data.name || 'Usuario sin nombre',
      email: data.email || '',
      registrationDate: data.registrationDate || new Date().toISOString(),
      profileComplete: !!data.profileComplete,
    };
  }
  const userRecord = await adminAuth.getUser(uid);
  return {
    name: 'Nuevo Usuario',
    email: userRecord.email || '',
    registrationDate: new Date().toISOString(),
    profileComplete: false,
  };
}

export default async function AdminPage() {
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) redirect('/login');

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect('/login');
  }

  const uid = decoded.uid;
  const user = await getUserData(uid);

  if (!user.profileComplete) redirect('/complete-profile');

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>¡Bienvenido de nuevo, {user.name}!</h1>
        <p className={styles.subtitle}>Nos alegra tenerte de vuelta en la sala de juegos.</p>
      </div>
    </div>
  );
}

