'use client';
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
          <input
            type="text"
            name="employeeCode"
            placeholder="Código de Empleado"
            className={styles.input}
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
