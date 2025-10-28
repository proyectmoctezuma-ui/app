'use client';

import { useEffect, useRef } from 'react';

export default function AppChromeOverlay() {
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const overlay = ref.current;
    if (!overlay) return undefined;

    const update = () => {
      const viewportHeight = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--viewport-height')
      ) || window.innerHeight;
      overlay.style.setProperty('--overlay-height', `${viewportHeight}px`);
    };

    update();

    const handler = () => update();
    window.addEventListener('viewport-height-change', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);

    return () => {
      window.removeEventListener('viewport-height-change', handler);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return <div ref={ref} className="app-chrome-overlay" />;
}
