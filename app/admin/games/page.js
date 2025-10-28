import React from 'react';
import Image from 'next/image';
import { getGames } from './actions'; // <--- CORRECCIÓN: Importar la función correcta
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '../../../lib/firebase-admin';

const styles = {
  container: {
    minHeight: '100%',
    flex: '1 1 auto',
    padding: 'clamp(1.25rem, 5vw, 4rem) clamp(1rem, 4vw, 2rem)',
    textAlign: 'center',
    backgroundColor: '#1a1a1a1b',
    color: '#FFFFFF',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
  },
  subtitle: {
    fontSize: '1.3rem',
    marginBottom: '3rem',
    color: '#ede5e5ff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '2rem',
  },
  coverWrap: {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%', // 16:9
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#151515',
    marginBottom: '1rem',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  card: {
    backgroundColor: '#2c2c2c44',
    borderRadius: '12px',
    padding: 'clamp(1rem, 3vw, 2rem)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between', // Alinea el contenido
  },
  cardTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
  },
  cardDescription: {
    fontSize: '1rem',
    color: '#c7c7c7',
    flexGrow: 1, // Permite que la descripción crezca
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    backdropFilter: 'blur(5px)', // Efecto de desenfoque
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  playButton: {
    marginTop: '1.5rem',
    padding: '0.8rem 1.5rem',
    backgroundColor: '#1FAA8F',
    color: '#212121ff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 'bold',
    display: 'inline-block',
    alignSelf: 'center', // Centra el botón
    border: 'none',
    cursor: 'pointer',
  },
  playedBadge: {
    marginTop: '1.5rem',
    padding: '0.6rem 1.2rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#b0b0b0',
    borderRadius: '8px',
    fontWeight: 'bold',
    display: 'inline-block',
    alignSelf: 'center',
  },
};

// El componente Card no necesita cambios, pero lo definimos aquí por completitud
function GameCard({ game, played }) {
  return (
    <div style={{ ...styles.card, ...(game.unlocked ? {} : { filter: 'grayscale(80%)' }) }}>
      <div>
        <div style={styles.coverWrap}>
          <Image
            src={game.image}
            alt={`Portada de ${game.title}`}
            fill
            sizes="(max-width: 600px) 100vw, 300px"
            style={{ objectFit: 'cover' }}
            priority={false}
          />
        </div>
        <h3 style={styles.cardTitle}>{game.title}</h3>
        <p style={styles.cardDescription}>{game.description}</p>
      </div>
      {game.unlocked ? (
        played ? (
          <div style={styles.playedBadge}>Jugado</div>
        ) : (
          <Link href={`/admin/games/${game.id}`} passHref>
             {/* El componente Link en las versiones recientes de Next.js no necesita un <a> anidado */}
            <button style={styles.playButton}>Jugar Ahora</button>
          </Link>
        )
      ) : (
        <div style={styles.lockedOverlay}>
          <span style={styles.icon}>&#128274;</span>
          <div>Bloqueado</div>
        </div>
      )}
    </div>
  );
}

// El componente principal de la página
export default async function GamesPage() {
  // <--- CORRECCIÓN: Llamar a getGames y usar su resultado directamente
  const allGames = await getGames();

  // Cargar mapa de scores del usuario autenticado
  let scoreMap = {};
  try {
    const sessionCookie = cookies().get('__session')?.value || '';
    if (sessionCookie) {
      const adminAuth = getAdminAuth();
      const adminDb = getAdminDb();
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      const uid = decoded?.uid;
      if (uid) {
        const snap = await adminDb.collection('users').doc(uid).collection('scores').get();
        snap.forEach((d) => { scoreMap[d.id] = d.data(); });
      }
    }
  } catch {}

  // El servidor de acciones maneja los errores internamente,
  // por lo que no necesitamos un manejo de errores complejo aquí.

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Sala de Juegos</h1>
      <p style={styles.subtitle}>Cada semana, un nuevo desafío te espera. ¿Estás listx?</p>
      <div style={styles.grid}>
        {/* <--- CORRECCIÓN: Mapear sobre la lista de juegos del servidor */}
        {allGames.map((game) => {
          const played = !!scoreMap[String(game.id)];
          return <GameCard key={game.id} game={game} played={played} />;
        })}
      </div>
    </div>
  );
}
