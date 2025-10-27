"use client";

import { useEffect } from "react";
import styles from "./ui/Status.module.css";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>¡Oops! Algo salió mal</h1>
        <p className={styles.subtitle}>
          Se ha producido un error inesperado. Por favor, inténtalo de nuevo.
        </p>
        <button className={styles.btn} onClick={() => reset()}>Reintentar</button>
      </div>
    </div>
  );
}

