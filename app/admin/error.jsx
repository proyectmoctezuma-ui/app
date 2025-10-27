"use client";

import { useEffect } from "react";
import styles from "../ui/Status.module.css";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error("Error en la sección de Administración:", error);
  }, [error]);

  return (
    <div className={`${styles.screen} ${styles.screenAdmin}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>Error en el Panel</h1>
        <p className={styles.subtitle}>
          Ha ocurrido un problema al cargar esta sección. Puedes intentar recargarla.
        </p>
        <button className={styles.btn} onClick={() => reset()}>Reintentar</button>
      </div>
    </div>
  );
}

