'use server';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { app } from '../../lib/firebase-admin';

const db = getDatabase(app);
const auth = getAuth(app);

// Función auxiliar para encontrar un usuario por su código de empleado
async function findUserByEmployeeCode(employeeCode) {
  const usersRef = db.ref('users');
  const snapshot = await usersRef.orderByChild('employeeCode').equalTo(employeeCode).limitToFirst(1).once('value');
  if (snapshot.exists()) {
    const uid = Object.keys(snapshot.val())[0];
    const userData = snapshot.val()[uid];
    return { uid, ...userData };
  }
  return null;
}

export async function verifyCode(employeeCode) {
  if (!employeeCode) {
    return { success: false, error: 'El código de empleado no puede estar vacío.' };
  }
  try {
    const user = await findUserByEmployeeCode(employeeCode);
    if (user) {
      return { success: true };
    } else {
      return { success: false, error: 'El código de empleado no es válido.' };
    }
  } catch (error) {
    console.error('Error al verificar el código:', error);
    return { success: false, error: 'Ocurrió un error al verificar el código. Por favor, inténtalo de nuevo.' };
  }
}

export async function resetPassword(employeeCode, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  try {
    const user = await findUserByEmployeeCode(employeeCode);
    if (!user) {
      return { success: false, error: 'No se encontró el usuario. No se puede restablecer la contraseña.' };
    }

    await auth.updateUser(user.uid, {
      password: newPassword,
    });

    return { success: true };
  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
    return { success: false, error: 'Ocurrió un error al restablecer la contraseña. Por favor, inténtalo de nuevo.' };
  }
}
