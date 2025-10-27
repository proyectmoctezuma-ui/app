'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { handleLogout } from '../../lib/auth';
import styles from './Navbar.module.css';

const Navbar = () => {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdminRoute = pathname.startsWith('/admin');

  // Cierra el menú al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // En escritorio, asegura menú cerrado al redimensionar
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <Link href={isAdminRoute ? '/admin' : '/'}>
          <Image
            src="/moctezuma_logo_white.svg"
            alt="Logo de Moctezuma"
            width={160}
            height={55}
            className={styles.logo}
          />
        </Link>
      </div>

      <button
        className={styles.burger}
        aria-label="Abrir menú"
        aria-expanded={menuOpen}
        aria-controls="primary-nav"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className={styles.burgerBar} />
        <span className={styles.burgerBar} />
        <span className={styles.burgerBar} />
      </button>

      {isAdminRoute ? (
        <div
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.menuOpen : ''}`}
        >
          <Link
            href="/admin"
            className={`${styles.navLink} ${pathname === '/admin' ? styles.active : ''}`}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/games"
            className={`${styles.navLink} ${pathname === '/admin/games' ? styles.active : ''}`}
          >
            Juegos
          </Link>
          <Link
            href="/admin/scores"
            className={`${styles.navLink} ${pathname === '/admin/scores' ? styles.active : ''}`}
          >
            Puntuaciones
          </Link>
          <button onClick={handleLogout} className={`${styles.logoutButton} ${styles.navAction}`}>
            Cerrar Sesión
          </button>
        </div>
      ) : (
        // Navegación para páginas públicas (login, registro)
        <div
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.menuOpen : ''}`}
        >
          <Link
            href="/login"
            className={`${styles.navLink} ${pathname === '/login' ? styles.active : ''}`}
          >
            Login
          </Link>
          <Link
            href="/register"
            className={`${styles.navLink} ${pathname === '/register' ? styles.active : ''}`}
          >
            Register
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

