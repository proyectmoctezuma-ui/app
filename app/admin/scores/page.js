import React from 'react';

const scores = [
  { game: 'Serpiente de Sombras', score: 1200, rank: 3 },
  { game: 'El Tesoro de Quetzalcóatl', score: 850, rank: 12 },
  { game: 'Guerrero Jaguar', score: 950, rank: 7 },
  { game: 'El Vuelo del Águila', score: 1500, rank: 1 },
  { game: 'Pirámide del Sol', score: 600, rank: 25 },
  { game: 'El Ritual Sagrado', score: 0, rank: 'N/A' }, // Aún no jugado
];

const styles = {
  container: {
    minHeight: 'calc(100vh - 70px)',
    padding: '4rem 2rem',
    backgroundColor: '#1a1a1a',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '2rem',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
  },
  table: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    borderCollapse: 'collapse',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
    backgroundColor: '#2c2c2c',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  th: {
    padding: '1.5rem',
    backgroundColor: '#383838',
    borderBottom: '2px solid #e5a00d',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  td: {
    padding: '1.2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '1.1rem',
  },
  rank: {
    fontWeight: 'bold',
    color: '#e5a00d', // Destaca el rango con el color de la marca
  },
};

export default function ScoresPage() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mis Puntuaciones</h1>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Juego</th>
            <th style={styles.th}>Puntuación</th>
            <th style={styles.th}>Rango</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, index) => (
            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#2c2c2c' : '#343434' }}>
              <td style={styles.td}>{score.game}</td>
              <td style={styles.td}>{score.score}</td>
              <td style={{ ...styles.td, ...styles.rank }}>{score.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
