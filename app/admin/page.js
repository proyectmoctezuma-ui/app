import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '../../lib/firebase-admin';

async function getUserData(uid) {
  if (!uid) return null;

  try {
    const userRef = adminDb.ref(`/users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (userData) {
      return {
        name: userData.name || 'Usuario sin nombre',
        email: userData.email,
        // Aseguramos que siempre haya una fecha de registro.
        registrationDate: userData.registrationDate || new Date().toISOString(),
      };
    } else {
      // Si no hay datos en la base de datos, obtenemos el email del servicio de Auth.
      const userRecord = await adminAuth.getUser(uid);
      return { name: 'Nuevo Usuario', email: userRecord.email };
    }
  } catch (error) {
    console.error('Error al obtener los datos del usuario:', error);
    // En caso de error, devolvemos un objeto con valores por defecto.
    return { name: 'Error al cargar', email: '' };
  }
}

export default async function AdminPage() {
  const sessionCookie = cookies().get('session')?.value;
  let uid = null;

  if (sessionCookie) {
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
      uid = decodedClaims.uid;
    } catch (error) {
      // Si la cookie es inválida o ha expirado, redirigimos al login.
      if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/invalid-session-cookie') {
        redirect('/login');
      }
      console.error('Error al verificar la cookie de sesión:', error);
      redirect('/login');
    }
  } else {
    // Si no hay cookie, el usuario no está autenticado.
    redirect('/login');
  }

  // Con un UID válido, obtenemos los datos del usuario.
  const userData = await getUserData(uid);

  // Si no se encuentran los datos del usuario, algo salió mal.
  if (!userData) {
    console.error('No se pudieron cargar los datos del usuario.');
    // Aquí podrías redirigir a una página de error o mostrar un mensaje.
    return <div>Error al cargar la información del usuario.</div>;
  }

  // Renderizamos el saludo de bienvenida.
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: 'calc(100vh - 70px)', // Resta la altura del Navbar
      backgroundColor: '#121212',
      color: '#FFFFFF',
      textAlign: 'center',
    }}>
      <div>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>¡Bienvenido de nuevo, {userData.name}!</h1>
        <p style={{ fontSize: '1.2rem', color: '#B0B0B0' }}>Nos alegra tenerte de vuelta en la sala de juegos.</p>
      </div>
    </div>
  );
}
