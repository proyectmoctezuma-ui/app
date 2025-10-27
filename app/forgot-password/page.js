"use client";
import { useState } from 'react';
import { verifyCode, resetPassword } from './actions';
import styles from './ForgotPassword.module.css';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const result = await verifyCode(employeeCode, fullName);
    setIsLoading(false);
    if (result.success) {
      setStep(2);
    } else {
      setError(result.error);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setIsLoading(true);
    const result = await resetPassword(employeeCode, fullName, newPassword);
    setIsLoading(false);
    if (result.success) {
      alert('Contraseña actualizada exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.');
      window.location.href = '/login';
    } else {
      setError(result.error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
          </div>
        )}
        <h1 className={styles.title}>Recuperar Contraseña</h1>
        {error && <p className={styles.error}>{error}</p>}

        {step === 1 && (
          <form onSubmit={handleVerifyCode} className={styles.form}>
            <p className={styles.subtitle}>
              Ingresa tu código de empleado y tu nombre para verificar tu identidad.
            </p>
            <input
              type="text"
              placeholder="Código de Empleado"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              onInput={(e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
              }}
              inputMode="numeric"
              pattern="[0-9]{8}"
              title="El código de empleado debe tener exactamente 8 dígitos."
              maxLength={8}
              className={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Nombre Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <p className={styles.subtitle}>Ingresa tu nueva contraseña.</p>
            <input
              type="password"
              placeholder="Nueva Contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Confirmar Nueva Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

