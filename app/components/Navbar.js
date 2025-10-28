'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { handleLogout } from '../../lib/auth';
import styles from './Navbar.module.css';

const Navbar = () => {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);

  const isAdminRoute = pathname.startsWith('/admin');
  const isGamePlayRoute = /^\/admin\/games\/\d+/.test(pathname);
  const navbarClassName = [styles.navbar, isGamePlayRoute ? styles.hideOnMobile : '']
    .filter(Boolean)
    .join(' ');
  const mobileHidden = isGamePlayRoute;

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Hide mobile dropdown on desktop resize
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    let frameId = null;

    const updateMetrics = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!isAdminRoute || isGamePlayRoute) {
          root.style.setProperty('--navbar-mobile-height', '0px');
          root.style.setProperty('--admin-content-offset', '0px');
          return;
        }
        const navEl = navRef.current;
        if (!navEl) return;
        const rect = navEl.getBoundingClientRect();
        const height = rect?.height || 0;
        root.style.setProperty('--navbar-mobile-height', `${height}px`);
        root.style.setProperty('--admin-content-offset', `${height}px`);
      });
    };

    updateMetrics();

    const events = ['resize', 'orientationchange', 'viewport-height-change'];
    events.forEach((evt) => window.addEventListener(evt, updateMetrics));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateMetrics));
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isAdminRoute, isGamePlayRoute, menuOpen]);

  return (
    <nav
      ref={navRef}
      className={navbarClassName}
      data-mobile-fixed="true"
      data-mobile-hidden={mobileHidden ? 'true' : 'false'}
    >
      <div className={styles.logoContainer}>
        <Link href={isAdminRoute ? '/admin/games' : '/'}>
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
        aria-label="Abrir menu"
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
            Cerrar Sesion
          </button>
        </div>
      ) : (
        // Public navigation (login/register)
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

