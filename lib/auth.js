import { signOut } from 'firebase/auth';
import { auth } from './firebase-client'; // Asegúrate de que esta ruta sea correcta
import Cookies from 'js-cookie';

export const handleLogout = async () => {
  try {
    // Cierra la sesión en Firebase
    await signOut(auth);

    // Notifica al backend para invalidar la cookie httpOnly
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {});

    // Elimina cookies accesibles desde el cliente si existieran
    Cookies.remove('uid');

    // Redirige al usuario a la página de inicio de sesión
    window.location.href = '/';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};
