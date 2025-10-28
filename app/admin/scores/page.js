import React from "react";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "lib/firebase-admin";
import { getGames } from "../games/actions";
import styles from "./Scores.module.css";

async function getUid() {
  const adminAuth = getAdminAuth();
  const sessionCookie = cookies().get("__session")?.value || "";
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
  const snap = await adminDb.collection("users").doc(uid).collection("scores").get();
  const map = {};
  snap.forEach((d) => {
    map[d.id] = d.data();
  });
  return map;
}

export default async function ScoresPage() {
  const uid = await getUid();
  const [games, scoreMap] = await Promise.all([
    getGames(),
    getUserScores(uid),
  ]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Mis Puntuaciones</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              <th className={styles.headCell}>Juego</th>
              <th className={styles.headCell}>Puntuación</th>
              <th className={styles.headCell}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => {
              const entry = scoreMap[String(game.id)] || null;
              const played = !!entry;
              const rowClassName = [styles.row, !game.unlocked ? styles.lockedRow : ""]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={game.id} className={rowClassName}>
                  <td className={styles.cell} data-label="Juego">
                    {scoreMap[String(game.id)]?.gameTitle || game.title}
                  </td>
                  <td className={styles.cell} data-label="Puntuación">
                    {played ? entry.score : "-"}
                  </td>
                  <td className={styles.cell} data-label="Estado">
                    {played
                      ? "Jugado"
                      : game.unlocked ? (
                        <span className={`${styles.badge} ${styles.unlockedBadge}`}>
                          Desbloqueado
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.lockedBadge}`}>
                          Bloqueado
                        </span>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}