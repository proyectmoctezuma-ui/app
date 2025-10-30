import './globals.css';
import { Inter } from 'next/font/google';
import ViewportMetricsProvider from './components/ViewportMetricsProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Reto Moctezumer',
  description: 'Plataforma de juegos interactivos.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1FAA8F',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        className={inter.className}
        style={{
          backgroundImage: `url('/bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'var(--app-surface)',
          margin: 0,
          minHeight: 'var(--viewport-height, 100dvh)'
        }}
      >
        <ViewportMetricsProvider />
        {children}
      </body>
    </html>
  );
}
