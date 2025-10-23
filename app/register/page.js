'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './Register.module.css';
import { getAuth, GoogleAuthProvider, signInWithRedirect, createUserWithEmailAndPassword } from 'firebase/auth';
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
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      console.error('Error durante el inicio de sesión con Google:', error);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      const response = await fetch('/api/auth/session', { // Ruta corregida
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Error al crear la sesión.');
      }

      router.push('/complete-profile');
    } catch (error) {
      setError(error.message);
      console.error('Error durante el registro con email:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Crear Cuenta</h1>
        {error && <p className={styles.error}>{error}</p>}
        <button onClick={handleGoogleSignIn} className={styles.googleButton}>
          <Image src="/google-icon.svg" alt="Google icon" width={20} height={20} />
          Registrarse con Google
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
            placeholder="Contraseña"
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
