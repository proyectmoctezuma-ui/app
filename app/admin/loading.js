import styles from '../ui/Status.module.css';

export default function Loading() {
  return (
    <div className={`${styles.screen} ${styles.screenAdmin}`}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.title}>Cargando panel…</p>
      </div>
    </div>
  );
}
