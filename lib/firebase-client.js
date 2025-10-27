'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let firebaseConfig = {};

// 1. Intenta leer la configuración desde la variable JSON única (¡TU LÓGICA CORRECTA!)
const configJson = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
if (configJson) {
  try {
    firebaseConfig = JSON.parse(configJson);
  } catch (e) {
    console.error("[Firebase] Error al parsear NEXT_PUBLIC_FIREBASE_CONFIG:", e);
  }
} else {
  // 2. Si no existe, usa las variables de entorno individuales (mi lógica de respaldo).
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

// 4. Valida que las variables esenciales existan, sin importar de dónde vinieron.
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
  const errorMsg = `Configuración de Firebase incompleta. Revisa tus variables de entorno. Faltan: ${missingFields.join(', ')}`;
  console.error(errorMsg, firebaseConfig);
  throw new Error(errorMsg);
}

// 5. Inicializa la app de Firebase, asegurando que solo se haga una vez.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

export { app, auth, firestore };
