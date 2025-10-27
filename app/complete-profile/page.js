// app/complete-profile/page.js
"use client";

import { useFormState, useFormStatus } from 'react-dom';
import { saveProfile } from './actions';
import styles from './CompleteProfile.module.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={styles.submitButton}>
      {pending ? 'Guardando...' : 'Guardar Perfil'}
    </button>
  );
}

function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.spinner} />
    </div>
  );
}

export default function CompleteProfilePage() {
  const [state, formAction] = useFormState(saveProfile, null);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Completa tu Perfil</h1>
        <p className={styles.subtitle}>
          Por favor, ingresa tu código de empleado y nombre para continuar.
        </p>

        <form action={formAction} className={styles.form}>
          <PendingOverlay />
          <input
            type="text"
            name="employeeCode"
            placeholder="Código de Empleado"
            className={styles.input}
            inputMode="numeric"
            pattern="[0-9]{8}"
            title="El código de empleado debe tener exactamente 8 dígitos."
            maxLength={8}
            onInput={(e) => {
              // Fuerza solo dígitos y máx. 8 caracteres
              e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
            }}
            required
          />
          <input
            type="text"
            name="name"
            placeholder="Nombre Completo"
            className={styles.input}
            required
          />

          <SubmitButton />
          {state?.error && <p className={styles.error}>{state.error}</p>}
        </form>
      </div>
    </div>
  );
}

