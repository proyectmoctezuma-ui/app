'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '../../lib/firebase-admin';

export async function saveProfile(prevState, formData) {
  // Leemos directamente la cookie 'uid' para obtener el ID de usuario.
  const uid = cookies().get('uid')?.value;

  if (!uid) {
    return { error: 'No autenticado. ID de usuario no encontrado.' };
  }

  try {
    // Para mayor seguridad, obtenemos los datos del usuario directamente de Firebase Auth.
    const userRecord = await adminAuth.getUser(uid);
    const email = userRecord.email;

    if (!email) {
      return { error: 'No se pudo encontrar el email del usuario.' };
    }

    const ref = adminDb.ref(`/users/${uid}`);
    const employeeCode = formData.get('employeeCode');
    const name = formData.get('name');

    // Guardamos los datos del perfil junto con la fecha de registro.
    await ref.set({
      employeeCode,
      name,
      email,
      registrationDate: new Date().toISOString(),
    });

    revalidatePath('/admin');
    redirect('/admin');

  } catch (error) {
    console.error('Error al guardar el perfil:', error);
    return { error: 'Ocurrió un error al guardar tu perfil. Por favor, inténtalo de nuevo.' };
  }
}
