'use server';

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '../../../lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();

// Definición de los juegos disponibles
// Usa imágenes locales desde /public/game-covers.
// Para evitar 404 mientras faltan portadas definitivas,
// 4-6 reutilizan 1.jpg/2.jpg/3.jpg como placeholders.
const allGames = [
  { id: 1, title: 'Construyendo el propósito', description: 'Nuestro propósito se construye pieza por pieza. Une cada parte y descubre la fuerza de lo que nos inspira a avanzar.', unlocked: true, image: '/game-covers/1.jpg' },
  { id: 2, title: 'Cada decisión es una vía.', description: 'Guía el tren por el camino correcto, demostrando que la Honestidad e Integridad son los rieles que nos conducen e impulsan a un futuro sólido.', unlocked: false, image: '/game-covers/2.jpg' },
  { id: 3, title: 'Escaleras verdes', description: 'Avanza con conciencia y descubre cómo cada paso que das puede generar un impacto positivo en el Cuidado de Nuestro Planeta.', unlocked: false, image: '/game-covers/3.jpg' },
  { id: 4, title: 'Memórama de la inclusión', description: '¡Encuentra coincidencias, celebra la diversidad y aprende que con Respeto e Inclusión, construimos un ambiente de colaboración positivo!', unlocked: false, image: '/game-covers/4.jpg' },
  { id: 5, title: 'Ojo con el riesgo', description: 'Cada condición insegura que detectes es una vida que proteges. Actúa con Valor por la Vida: pon a prueba tu atención y conviértete en guardián de la seguridad.', unlocked: false, image: '/game-covers/5.jpg' },
  { id: 6, title: 'Precisión con propósito', description: 'Afina tu puntería y demuestra que con Enfoque y Determinación, alcanzas el objetivo con la fuerza de quien no deja nada al azar.', unlocked: false, image: '/game-covers/6.jpg' },
];

function normalizeToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

async function getRegistrationDate(uid) {
  if (!uid) return new Date();

  try {
    const doc = await adminDb.collection('users').doc(uid).get();
    if (!doc.exists) return new Date();
    const data = doc.data();

    return (
      normalizeToDate(data?.registrationDate) ||
      normalizeToDate(data?.createdAt) ||
      new Date()
    );
  } catch (error) {
    console.error('Error al obtener la fecha de registro:', error);
    return new Date();
  }
}

export async function getGames() {
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) return allGames; // Devuelve juegos con bloqueo por defecto

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const registrationDate = await getRegistrationDate(decodedClaims.uid);
    const weeksSinceRegistration = Math.max(
      0,
      Math.floor((Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 7)),
    );

    const unlockedGamesCount = Math.min(1 + weeksSinceRegistration, allGames.length);

    return allGames.map((game, index) => ({
      ...game,
      unlocked: index < unlockedGamesCount,
    }));

  } catch (error) {
    console.error('Error al obtener los juegos desbloqueados:', error);
    // En caso de error, solo se muestra el primer juego desbloqueado.
    return allGames.map((game, index) => ({ ...game, unlocked: index === 0 }));
  }
}

