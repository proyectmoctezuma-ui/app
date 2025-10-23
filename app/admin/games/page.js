import React from 'react';
import { getUnlockedGames } from './actions';
import Link from 'next/link';

const games = [
  { id: 1, title: 'Serpiente de Sombras', description: 'Guía a la serpiente a través de laberintos oscuros.', href: '#' },
  { id: 2, title: 'El Tesoro de Quetzalcóatl', description: 'Resuelve acertijos para encontrar el tesoro perdido.', href: '#' },
  { id: 3, title: 'Guerrero Jaguar', description: 'Lucha contra enemigos en una batalla épica.', href: '#' },
  { id: 4, title: 'El Vuelo del Águila', description: 'Vuela por los cielos evitando obstáculos.', href: '#' },
  { id: 5, title: 'Pirámide del Sol', description: 'Construye la pirámide más alta del imperio.', href: '#' },
  { id: 6, title: 'El Ritual Sagrado', description: 'Completa el ritual antes de que se ponga el sol.', href: '#' },
];

const styles = {
  container: {
    minHeight: 'calc(100vh - 70px)',
    padding: '4rem 2rem',
    textAlign: 'center',
    backgroundColor: '#1a1a1a', // Un fondo oscuro para resaltar las tarjetas
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
    color: '#b0b0b0', // Un gris claro para el subtítulo
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', // Rejilla responsive
    gap: '2rem',
  },
  card: {
    backgroundColor: '#2c2c2c',
    borderRadius: '12px',
    padding: '2rem',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
  },
  cardDescription: {
    fontSize: '1rem',
    color: '#c7c7c7',
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
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
};

function GameCard({ game, isLocked }) {
  return (
    <div style={{ ...styles.card, ...(isLocked ? { filter: 'grayscale(100%)' } : {}) }}>
      <h3 style={styles.cardTitle}>{game.title}</h3>
      <p style={styles.cardDescription}>{game.description}</p>
      {isLocked ? (
        <div style={styles.lockedOverlay}>
          <span style={styles.icon}>&#128274;</span> {/* Icono de candado */}
          <div>Bloqueado</div>
        </div>
      ) : (
        <Link href={game.href} passHref>
          <a style={{ 
            marginTop: '1.5rem', 
            padding: '0.8rem 1.5rem', 
            backgroundColor: '#e5a00d', 
            color: '#1a1a1a', 
            borderRadius: '8px', 
            textDecoration: 'none', 
            fontWeight: 'bold', 
            display: 'inline-block' 
          }}>
            Jugar Ahora
          </a>
        </Link>
      )}
    </div>
  );
}

export default async function GamesPage() {
  const { unlockedCount, error } = await getUnlockedGames();

  if (error) {
    return <p style={{ color: 'red', textAlign: 'center', marginTop: '2rem' }}>{error}</p>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Sala de Juegos</h1>
      <p style={styles.subtitle}>Cada semana, un nuevo desafío te espera. ¿Estás listo?</p>
      <div style={styles.grid}>
        {games.map((game, index) => (
          <GameCard key={game.id} game={game} isLocked={index >= unlockedCount} />
        ))}
      </div>
    </div>
  );
}
