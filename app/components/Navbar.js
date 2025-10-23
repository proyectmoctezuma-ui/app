'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { handleLogout } from '../../lib/auth';
import styles from './Navbar.module.css';

const Navbar = () => {
  const pathname = usePathname();

  // Solo muestra la navegación completa si el usuario está en el área de administración
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <Link href={isAdminRoute ? '/admin' : '/'}>
          <Image
            src="/moctezuma_logo_white.svg"
            alt="Logo de Moctezuma"
            width={160} // Ligeramente más grande para mejor visibilidad
            height={55}
            className={styles.logo}
          />
        </Link>
      </div>

      {isAdminRoute ? (
        // Navegación para el dashboard de administración
        <div className={styles.navLinks}>
          <Link href="/admin" className={`${styles.navLink} ${pathname === '/admin' ? styles.active : ''}`}>
            Dashboard
          </Link>
          <Link href="/admin/games" className={`${styles.navLink} ${pathname === '/admin/games' ? styles.active : ''}`}>
            Juegos
          </Link>
          <Link href="/admin/scores" className={`${styles.navLink} ${pathname === '/admin/scores' ? styles.active : ''}`}>
            Puntuaciones
          </Link>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Cerrar Sesión
          </button>
        </div>
      ) : (
        // Navegación para las páginas públicas (login, registro)
        <div className={styles.navLinks}>
          <Link href="/login" className={`${styles.navLink} ${pathname === '/login' ? styles.active : ''}`}>
            Login
          </Link>
          <Link href="/register" className={`${styles.navLink} ${pathname === '/register' ? styles.active : ''}`}>
            Register
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
