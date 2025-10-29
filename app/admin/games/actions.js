'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '../../../lib/firebase-admin';

const adminAuth = getAdminAuth();
const adminDb = getAdminDb();
const availabilityDocRef = adminDb.collection('config').doc('gameAvailability');

const SUPER_ADMIN_EMAIL = 'sor.filotea.1@gmail.com'; // Reemplaza por el correo real del super administrador.

const allGames = [
  {
    id: 1,
    title: 'Construyendo el propósito',
    description: 'Nuestro propósito se construye pieza por pieza. Une cada parte y descubre la fuerza de lo que nos inspira a avanzar.',
    unlocked: true,
    image: '/game-covers/1.jpg',
  },
  {
    id: 2,
    title: 'Cada decisión es una vía.',
    description: 'Guia el tren por el camino correcto, demostrando que la Honestidad e Integridad son los rieles que nos conducen e impulsan a un futuro solido.',
    unlocked: true,
    image: '/game-covers/2.jpg',
  },
  {
    id: 3,
    title: 'Escaleras verdes',
    description: 'Avanza con conciencia y descubre como cada paso que das puede generar un impacto positivo en el Cuidado de Nuestro Planeta.',
    unlocked: true,
    image: '/game-covers/3.jpg',
  },
  {
    id: 4,
    title: 'Memorama de la inclusion',
    description: 'Encuentra coincidencias, celebra la diversidad y aprende que con Respeto e Inclusion, construimos un ambiente de colaboracion positivo.',
    unlocked: false,
    image: '/game-covers/4.jpg',
  },
  {
    id: 5,
    title: 'Ojo con el riesgo',
    description: 'Cada condicion insegura que detectes es una vida que proteges. Actua con Valor por la Vida: pon a prueba tu atencion y conviertete en guardian de la seguridad.',
    unlocked: false,
    image: '/game-covers/5.jpg',
  },
  {
    id: 6,
    title: 'Precision con proposito',
    description: 'Afina tu punteria y demuestra que con Enfoque y Determinacion, alcanzas el objetivo con la fuerza de quien no deja nada al azar.',
    unlocked: false,
    image: '/game-covers/6.jpg',
  },
];

const createDefaultUnlockedMap = () =>
  allGames.reduce((acc, game) => {
    acc[String(game.id)] = Boolean(game.unlocked);
    return acc;
  }, {});

const normalizeUnlockedOverrides = (overrides = {}) => {
  const normalized = createDefaultUnlockedMap();
  Object.entries(overrides || {}).forEach(([key, value]) => {
    normalized[String(key)] = Boolean(value);
  });
  return normalized;
};

async function getSessionClaims() {
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error('Error al verificar la sesion:', error);
    return null;
  }
}

function isSuperAdminEmail(email) {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
}

export async function getSuperAdminContext() {
  const claims = await getSessionClaims();
  if (!claims || !isSuperAdminEmail(claims.email)) return null;
  return { uid: claims.uid, email: claims.email };
}

async function assertSuperAdmin() {
  const context = await getSuperAdminContext();
  if (!context) {
    throw new Error('FORBIDDEN_SUPER_ADMIN_ONLY');
  }
  return context;
}

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

export async function getGameAvailabilitySettings() {
  try {
    const doc = await availabilityDocRef.get();
    if (!doc.exists) {
      return {
        manualControlEnabled: false,
        unlockedGames: createDefaultUnlockedMap(),
        updatedAt: null,
        updatedBy: null,
      };
    }

    const data = doc.data() || {};

    return {
      manualControlEnabled: Boolean(data.manualControlEnabled),
      unlockedGames: normalizeUnlockedOverrides(data.unlockedGames),
      updatedAt: normalizeToDate(data.updatedAt),
      updatedBy: data.updatedBy || null,
    };
  } catch (error) {
    console.error('Error al leer la configuracion de juegos:', error);
    return {
      manualControlEnabled: false,
      unlockedGames: createDefaultUnlockedMap(),
      updatedAt: null,
      updatedBy: null,
    };
  }
}

export async function updateGameAvailabilityAction(formData) {
  try {
    const superAdmin = await assertSuperAdmin();

    const manualControlEnabled = formData.get('manualControlEnabled') === 'on';
    const unlockedGames = createDefaultUnlockedMap();

    allGames.forEach((game) => {
      const fieldName = `game-${game.id}`;
      unlockedGames[String(game.id)] = formData.get(fieldName) === 'on';
    });

    await availabilityDocRef.set(
      {
        manualControlEnabled,
        unlockedGames,
        updatedAt: new Date(),
        updatedBy: superAdmin.email,
      },
      { merge: true },
    );

    revalidatePath('/admin/games');
    revalidatePath('/admin/games/control');

    return {
      ok: true,
      manualControlEnabled,
      unlockedGames,
    };
  } catch (error) {
    console.error('Error al actualizar la configuracion de juegos:', error);
    return { ok: false, error: error.message || 'unknown-error' };
  }
}

export async function getAllGamesCatalog() {
  return allGames.map((game) => ({ ...game }));
}

export async function getGames() {
  const availabilitySettings = await getGameAvailabilitySettings();

  if (availabilitySettings.manualControlEnabled) {
    return allGames.map((game) => ({
      ...game,
      unlocked: Boolean(availabilitySettings.unlockedGames[String(game.id)]),
    }));
  }

  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    return allGames.map((game) => ({ ...game }));
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const registrationDate = await getRegistrationDate(decodedClaims.uid);
    const weeksSinceRegistration = Math.max(
      0,
      Math.floor((Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 7)),
    );

    const unlockedGamesCount = Math.min(3 + weeksSinceRegistration, allGames.length);

    return allGames.map((game, index) => ({
      ...game,
      unlocked: index < unlockedGamesCount,
    }));
  } catch (error) {
    console.error('Error al obtener los juegos desbloqueados:', error);
    return allGames.map((game, index) => ({ ...game, unlocked: index === 0 }));
  }
}
