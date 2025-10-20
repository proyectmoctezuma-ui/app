'use client'

import Image from 'next/image';
import Link from 'next/link';
import styles from './Navbar.module.css';

const Navbar = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <Link href="/">
          <Image
            src="/moctezuma_logo_white.svg"
            alt="Logo de Moctezuma"
            width={150}
            height={50}
            className={styles.logo}
          />
        </Link>
      </div>
      <div className={styles.navLinks}>
        <Link href="/login" className={styles.navLink}>
          Login
        </Link>
        <Link href="/register" className={styles.navLink}>
          Register
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;