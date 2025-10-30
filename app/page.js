
import Image from 'next/image';
import Link from 'next/link';
import styles from './Welcome.module.css';

export default function WelcomePage() {
  return (
    <main className={styles.container}>
       <Image
                src="/vida_moctezuma.svg"
                alt="Logo de Moctezuma"
                width={250} // Ancho del logo
                height={250}  // Alto del logo
                className={styles.logo}
              />
      <h1 className={styles.title}>Bienvenido/a</h1>
      <p className={styles.subtitle}>
        Plataforma de juegos interactivos y educativos.
      </p>
      <Link href="/login" className={styles.button}>
        Iniciar Sesión o Registrarse
      </Link>
    </main>
  );
}
