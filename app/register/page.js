
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './Register.module.css';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { app } from '../../lib/firebase-client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();
  const auth = getAuth(app);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Enviar el token a nuestra API para crear una cookie de sesión
      await fetch('/api/auth/session-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      router.push('/admin');
    } catch (error) {
      setError(error.message);
      console.error('Error durante el registro con Google:', error);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Enviar el token a nuestra API para crear una cookie de sesión
      await fetch('/api/auth/session-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      router.push('/admin');
    } catch (error) {
      setError(error.message);
      console.error('Error durante el registro con email:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Crear una Cuenta</h1>
        {error && <p className={styles.error}>{error}</p>}
        <button onClick={handleGoogleSignIn} className={styles.googleButton}>
          <img src="/google-icon.svg" alt="" />
          Regístrate con Google
        </button>
        <div className={styles.divider}>o</div>
        <form onSubmit={handleEmailSignUp} className={styles.form}>
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Contraseña (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.submitButton}>
            Crear Cuenta
          </button>
        </form>
        <p className={styles.footer}>
          ¿Ya tienes una cuenta? <Link href="/login">Inicia Sesión</Link>
        </p>
      </div>
    </div>
  );
}

