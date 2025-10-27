import styles from './ui/Status.module.css';

export default function Loading() {
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.title}>Cargando…</p>
      </div>
    </div>
  );
}
