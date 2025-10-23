'use server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

// Definición de los juegos disponibles
const allGames = [
  { id: 1, title: 'Construyendo el propósito', description: '.', unlocked: true, image: '/game-covers/serpiente_de_sombras.webp' },
  { id: 2, title: 'El tren de las decisiones', description: '.', unlocked: false, image: '/game-covers/tesoro_de_quetzalcoatl.webp' },
  { id: 3, title: 'Escaleras Verdes', description: '.', unlocked: false, image: '/game-covers/guerrero_jaguar.webp' },
  { id: 4, title: 'Memórama de la inclusión', description: ',', unlocked: false, image: '/game-covers/vuelo_del_aguila.webp' },
  { id: 5, title: 'Ojo con el riesgo', description: '.', unlocked: false, image: '/game-covers/piramide_del_sol.webp' },
  { id: 6, title: 'Precisión', description: ' .', unlocked: false, image: '/game-covers/ritual_sagrado.webp' },
];

async function getRegistrationDate(uid) {
  if (!uid) return new Date().toISOString();

  try {
    const userRef = adminDb.ref(`/users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    // Si no hay fecha de registro, se usa la fecha actual como fallback.
    return userData?.registrationDate || new Date().toISOString();
  } catch (error) {
    console.error('Error al obtener la fecha de registro:', error);
    return new Date().toISOString();
  }
}

export async function getGames() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return allGames; // Devuelve solo el primer juego desbloqueado por defecto

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const registrationDateStr = await getRegistrationDate(decodedClaims.uid);
    const registrationDate = new Date(registrationDateStr);
    const weeksSinceRegistration = Math.floor((new Date() - registrationDate) / (1000 * 60 * 60 * 24 * 7));

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
