'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

export async function saveProfile(prevState, formData) {
  // 1) Sesión
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) return { error: 'Sesión no encontrada. Inicia sesión.' };

  // 2) Verifica
  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return { error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' };
  }
  const uid = decoded.uid;

  // 3) Campos
  const employeeCode = String(formData.get('employeeCode') || '').trim();
  const name = String(formData.get('name') || '').trim();
  if (!employeeCode || !name) return { error: 'Faltan campos requeridos.' };

  // Validación: exactamente 8 dígitos numéricos
  if (!/^\d{8}$/.test(employeeCode)) {
    return { error: 'El código de empleado debe tener exactamente 8 dígitos.' };
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

  // 6) ¡No envolver en try/catch!
  redirect('/admin');
}
