import { redirect } from 'next/navigation';
import {
  getAllGamesCatalog,
  getGameAvailabilitySettings,
  getSuperAdminContext,
} from '../actions';
import AvailabilityForm from './AvailabilityForm';

const layoutStyles = {
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.75rem',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1.5rem',
  },
  title: {
    fontSize: '2.4rem',
    fontWeight: 700,
    margin: 0,
    color: '#fff',
  },
  subtitle: {
    margin: '0.5rem 0 0',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
  },
  info: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.7)',
  },
};

export default async function GameAvailabilityControlPage() {
  const superAdmin = await getSuperAdminContext();
  if (!superAdmin) {
    redirect('/admin/games');
  }

  const [settings, catalog] = await Promise.all([
    getGameAvailabilitySettings(),
    getAllGamesCatalog(),
  ]);

  const updatedLabel = settings.updatedAt
    ? new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(settings.updatedAt)
    : null;

  return (
    <div style={layoutStyles.container}>
      <header>
        <h1 style={layoutStyles.title}>Control manual de juegos</h1>
        <p style={layoutStyles.subtitle}>
          Esta ruta no aparece en el dashboard. Solo tu, como super administrador, puedes ajustar que juegos
          se muestran desbloqueados semana a semana.
        </p>
      </header>

      <section style={layoutStyles.card}>
        <AvailabilityForm initialSettings={settings} catalog={catalog} />
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={layoutStyles.info}>
            Ultima actualizacion:{' '}
            {updatedLabel ? `${updatedLabel} por ${settings.updatedBy || 'desconocido'}` : 'sin registros'}
          </span>
          <span style={layoutStyles.info}>Tu sesion: {superAdmin.email}</span>
        </div>
      </section>
    </div>
  );
}

