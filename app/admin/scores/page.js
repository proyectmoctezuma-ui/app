import React from 'react';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from 'lib/firebase-admin';
import { getGames } from '../games/actions';

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
    maxWidth: '900px',
    margin: '0 auto',
    borderCollapse: 'collapse',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
    backgroundColor: '#2c2c2c',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  th: {
    padding: '1.2rem',
    backgroundColor: '#383838',
    borderBottom: '2px solid #e5a00d',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    textAlign: 'left',
  },
  td: {
    padding: '1rem 1.2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '1rem',
    textAlign: 'left',
  },
  rank: {
    fontWeight: 'bold',
    color: '#e5a00d',
  },
  lockedRow: {
    opacity: 0.6,
    filter: 'blur(0.5px) grayscale(0.2)',
  },
  lockedBadge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#b0b0b0',
    fontSize: '0.85rem',
  },
  unlockedBadge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(229,160,13,0.15)',
    color: '#e5a00d',
    fontSize: '0.85rem',
  },
};

async function getUid() {
  const adminAuth = getAdminAuth();
  const sessionCookie = cookies().get('__session')?.value || '';
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

async function getUserScores(uid) {
  if (!uid) return {};
  const adminDb = getAdminDb();
  const snap = await adminDb.collection('users').doc(uid).collection('scores').get();
  const map = {};
  snap.forEach((d) => { map[d.id] = d.data(); });
  return map;
}

export default async function ScoresPage() {
  const uid = await getUid();
  const [games, scoreMap] = await Promise.all([
    getGames(),
    getUserScores(uid),
  ]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mis Puntuaciones</h1>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Juego</th>
            <th style={styles.th}>Puntuación</th>
            <th style={styles.th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => {
            const entry = scoreMap[String(game.id)] || null;
            const played = !!entry;
            const rowStyle = {
              backgroundColor: index % 2 === 0 ? '#2c2c2c' : '#343434',
              ...(!game.unlocked ? styles.lockedRow : {}),
            };
            return (
              <tr key={game.id} style={rowStyle}>
                <td style={styles.td}>{(scoreMap[String(game.id)]?.gameTitle) || game.title}</td>
                <td style={styles.td}>{played ? entry.score : '-'}</td>
                <td style={styles.td}>
                  {played
                    ? 'Jugado'
                    : (game.unlocked
                        ? <span style={styles.unlockedBadge}>Desbloqueado</span>
                        : <span style={styles.lockedBadge}>Bloqueado</span>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

