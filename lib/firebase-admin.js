import admin from 'firebase-admin';

// Evita la reinicialización de la aplicación en entornos de desarrollo.
if (admin.apps.length === 0) {
  admin.initializeApp({
    // Las credenciales se obtienen automáticamente del entorno de Firebase Studio.
    credential: admin.credential.applicationDefault(),
    // La URL de la base de datos debe ser la de tu proyecto.
    databaseURL: 'https://moctezuma-juegos-default-rtdb.firebaseio.com',
  });
}

// Exporta las instancias de los servicios de administración ya inicializados.
// Esto asegura que se utilicen las mismas instancias en toda la aplicación del servidor.
const adminAuth = admin.auth();
const adminDb = admin.database();

export { adminAuth, adminDb };
