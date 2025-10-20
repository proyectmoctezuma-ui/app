
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Juegos Moctezuma',
  description: 'Plataforma de juegos interactivos.',
  icons: {
    icon: '/icon.ico',
  },
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
          backgroundAttachment: 'fixed',
          margin: 0,
          minHeight: '100vh'
        }}
      >
        {children}
      </body>
    </html>
  );
}
