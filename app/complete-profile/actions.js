'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

export async function saveProfile(prevState, formData) {
  // 1) SesiÃ³n
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) return { error: 'SesiÃ³n no encontrada. Inicia sesiÃ³n.' };

  // 2) Verifica
  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return { error: 'SesiÃ³n invÃ¡lida o expirada. Vuelve a iniciar sesiÃ³n.' };
  }
  const uid = decoded.uid;

  // 3) Campos
  const employeeCode = String(formData.get('employeeCode') || '').trim();
  const name = String(formData.get('name') || '').trim();
  if (!employeeCode || !name) return { error: 'Faltan campos requeridos.' };

  // ValidaciÃ³n: exactamente 8 dÃ­gitos numÃ©ricos
  if (!/^\d{8}$/.test(employeeCode)) {
    return { error: 'El cÃ³digo de empleado debe tener exactamente 8 dÃ­gitos.' };
  }

  // 4) (opcional) email
  let email = decoded.email || null;
  if (!email) {
    try {
      const user = await adminAuth.getUser(uid);
      email = user.email || null;
    } catch {}
  }

  // 5) Guarda en Firestore
  await adminDb.collection('users').doc(uid).set({
    employeeCode,
    name,
    email,
    profileComplete: true,
    updatedAt: new Date(),
    createdAt: new Date(),
  }, { merge: true });

  // 6) Â¡No envolver en try/catch!
  redirect('/admin/games');
}
