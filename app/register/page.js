"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Register.module.css';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  setPersistence,
  browserSessionPersistence,
  onAuthStateChanged
} from 'firebase/auth';
import { app } from '../../lib/firebase-client';

async function createSessionAndRedirect(idToken) {
  const res = await fetch('/api/auth/session-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`El servidor respondió con ${res.status}`);
  const data = await res.json();
  if (data.sessionCookie) {
    document.cookie = `__session=${data.sessionCookie}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=Lax`;
  }
  if (data.status === 'success') window.location.assign('/admin/games');
  else if (data.status === 'incomplete-profile') window.location.assign('/complete-profile');
  else throw new Error('Respuesta inesperada del servidor.');
}

function humanizeAuthError(e) {
  const code = e?.code || '';
  if (code.includes('auth/email-already-in-use')) return 'Este correo ya está registrado.';
  if (code.includes('auth/weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  return e?.message || 'Ocurrió un error desconocido.';
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const auth = useMemo(() => getAuth(app), []);
  const processingSession = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const processUser = async (firebaseUser) => {
      if (!firebaseUser) {
        processingSession.current = false;
        if (!cancelled) setLoading(false);
        return;
      }

      if (processingSession.current) return;
      processingSession.current = true;

      try {
        const idToken = await firebaseUser.getIdToken(true);
        if (!cancelled) await createSessionAndRedirect(idToken);
      } catch (error) {
        processingSession.current = false;
        if (cancelled) return;
        console.error('Error al procesar sesión (registro):', error);
        setError(humanizeAuthError(error));
        setSubmitting(false);
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, processUser);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      processingSession.current = true;
      try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken(true);
        await createSessionAndRedirect(idToken);
      } catch (popupErr) {
        if (
          popupErr?.code === 'auth/popup-blocked' ||
          popupErr?.code === 'auth/popup-closed-by-user' ||
          popupErr?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err) {
      processingSession.current = false;
      setError(humanizeAuthError(err));
      setSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      processingSession.current = true;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken(true);
      await createSessionAndRedirect(idToken);
    } catch (error) {
      processingSession.current = false;
      setError(humanizeAuthError(error));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#121212', color: '#fff', textAlign: 'center', padding: '1rem' }}>
        <div style={{ width: 'min(720px,92vw)', padding: 'clamp(1rem,3vw,2rem)', borderRadius: 20, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(10px) saturate(120%)' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,.25)', borderTopColor: '#ff6b6b', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <style>{'@keyframes spin { to { transform: rotate(360deg);} }'}</style>
          <p style={{ margin: 0, fontWeight: 700 }}>Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {submitting && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
          </div>
        )}
        <h1 className={styles.title}>Crear Cuenta</h1>
        {error && <p className={styles.error}>{error}</p>}
        
        <button onClick={handleGoogleSignIn} className={styles.googleButton} disabled={submitting}>
          <Image src="/google-icon.svg" alt="Google icon" width={20} height={20} />
          Registrarse con Google
        </button>
        <div className={styles.divider}>o</div>
       

        <form onSubmit={handleEmailSignUp} className={styles.form}>
          <input type="email" placeholder="Correo Electrónico" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} required autoComplete="username"/>
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} required autoComplete="new-password" />
        <p className={styles.subtitle}>
          Ingresa una contraseña fácil de recordar y guárdala para no perder acceso a tu puntuación.
        </p>
          <button type="submit" className={styles.submitButton} disabled={submitting}>
            {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>
        <p className={styles.footer}>
          ¿Ya tienes una cuenta? <Link href="/login">Inicia Sesión</Link>
        </p>
      </div>
    </div>
  );
}
