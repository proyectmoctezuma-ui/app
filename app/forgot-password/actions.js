'use server';

import { getAdminAuth, getAdminDb } from '../../lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

async function findUserByEmployeeCode(employeeCode) {
  const snap = await adminDb
    .collection('users')
    .where('employeeCode', '==', employeeCode)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { uid: doc.id, ...doc.data() };
}

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

export async function verifyCode(employeeCode, name) {
  const code = String(employeeCode || '').trim();
  const fullName = String(name || '').trim();

  if (!code) {
    return { success: false, error: 'El código de empleado no puede estar vacío.' };
  }
  if (!/^\d{8}$/.test(code)) {
    return { success: false, error: 'El código de empleado debe tener exactamente 8 dígitos.' };
  }
  if (!fullName) {
    return { success: false, error: 'El nombre completo es obligatorio.' };
  }

  try {
    const user = await findUserByEmployeeCode(code);
    if (!user) {
      return { success: false, error: 'No fue posible verificar tus datos. Por favor, revisa la información.' };
    }

    if (normalize(user.name) !== normalize(fullName)) {
      return { success: false, error: 'No fue posible verificar tus datos. Por favor, revisa la información.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error al verificar los datos:', error);
    return { success: false, error: 'Ocurrió un error al verificar los datos. Inténtalo de nuevo.' };
  }
}

export async function resetPassword(employeeCode, name, newPassword) {
  const code = String(employeeCode || '').trim();
  const fullName = String(name || '').trim();

  // Reglas de contraseña más fuertes
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!(/[A-Za-z]/.test(newPassword) && /\d/.test(newPassword))) {
    return { success: false, error: 'La contraseña debe incluir letras y números.' };
  }

  if (!/^\d{8}$/.test(code) || !fullName) {
    return { success: false, error: 'No fue posible verificar tus datos.' };
  }

  try {
    const user = await findUserByEmployeeCode(code);
    if (!user) {
      return { success: false, error: 'No fue posible verificar tus datos.' };
    }
    if (normalize(user.name) !== normalize(fullName)) {
      return { success: false, error: 'No fue posible verificar tus datos.' };
    }

    await adminAuth.updateUser(user.uid, { password: newPassword });
    return { success: true };
  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
    return { success: false, error: 'Ocurrió un error al restablecer la contraseña. Inténtalo de nuevo.' };
  }
}

