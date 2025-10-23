'use client';

import Link from 'next/link';

export default function InteractiveLink({ href, children }) {
  return (
    <Link
      href={href}
      style={{
        marginTop: 30,
        padding: '15px 30px',
        fontSize: '1.2rem',
        color: '#4facfe',
        backgroundColor: 'white',
        borderRadius: 50,
        textDecoration: 'none',
        fontWeight: 'bold',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        transition: 'transform 0.2s',
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {children}
    </Link>
  );
}
