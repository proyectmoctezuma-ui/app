
import React from 'react';

// Estilos en línea para una apariencia limpia y centrada
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
    minHeight: 'calc(100vh - 70px)', // Ajusta la altura para descontar la navbar
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/bg.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: 'white', // Texto blanco para que contraste con el fondo
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)', // Sombra para legibilidad
    marginBottom: '1rem',
  },
  subtitle: {
    fontSize: '1.3rem',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)', // Sombra para legibilidad
    maxWidth: '600px',
  },
};

export default function AdminDashboard() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Panel de Administración</h1>
      <p style={styles.subtitle}>
        ¡Bienvenido! Desde aquí podrás gestionar los juegos y contenidos de la plataforma.
      </p>
    </div>
  );
}
