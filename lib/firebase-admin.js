
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Esta función asegura que Firebase se inicialice solo una vez.
const getFirebaseAdmin = () => {
  if (!admin.apps.length) {
    try {
      const serviceAccountPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json');
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://moctezuma-juegos-default-rtdb.firebaseio.com`,
      });
      console.log("Firebase Admin SDK inicializado usando la clave de la cuenta de servicio.");
    } catch (error) {
      console.error("Error al inicializar Firebase Admin SDK con la clave de servicio:", error);
      // Fallback a las credenciales predeterminadas de la aplicación
      admin.initializeApp({
        databaseURL: `https://moctezuma-juegos-default-rtdb.firebaseio.com`,
      });
      console.log("Firebase Admin SDK inicializado usando las credenciales predeterminadas de la aplicación (fallback).");
    }
  }
  return admin;
}

// Exportamos funciones que devuelven las instancias de auth y db.
export const getAdminAuth = () => getFirebaseAdmin().auth();
export const getAdminDb = () => getFirebaseAdmin().database();
