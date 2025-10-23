'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '../../lib/firebase-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const idToken = await result.user.getIdToken();
          const response = await fetch('/api/auth/session', { // Ruta corregida
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          if (!response.ok) {
            throw new Error('Error al crear la sesión.');
          }

          router.push('/admin');
        } else {
          setLoading(false);
        }
      } catch (error) {
        setError(error.message);
        setLoading(false);
        console.error('Error durante el resultado de la redirección de Google:', error);
      }
    };

    handleRedirectResult();
  }, [auth, router]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      console.error('Error durante el inicio de sesión con Google:', error);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      const response = await fetch('/api/auth/session', { // Ruta corregida
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Error al crear la sesión.');
      }

      router.push('/admin');
    } catch (error) {
      setError('Email o contraseña incorrectos. Por favor, inténtalo de nuevo.');
      console.error('Error durante el inicio de sesión con email:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Iniciar Sesión</h1>
        {error && <p className={styles.error}>{error}</p>}
        <button onClick={handleGoogleSignIn} className={styles.googleButton}>
          <Image src="/google-icon.svg" alt="Google icon" width={20} height={20} />
          Iniciar Sesión con Google
        </button>
        <div className={styles.divider}>o</div>
        <form onSubmit={handleEmailSignIn} className={styles.form}>
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
          <div className={styles.forgotPassword}>
            <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
          </div>
          <button type="submit" className={styles.submitButton}>
            Iniciar Sesión
          </button>
        </form>
        <p className={styles.footer}>
          ¿No tienes una cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
