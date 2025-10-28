'use client';

import { useEffect } from 'react';

function readViewportHeight() {
  if (typeof window === 'undefined') return null;
  const vv = window.visualViewport;
  const candidates = [window.innerHeight];
  if (vv) {
    candidates.push(vv.height - (vv.offsetTop || 0));
  }
  candidates.push(document.documentElement?.clientHeight || null);
  const filtered = candidates.filter((v) => typeof v === 'number' && !Number.isNaN(v) && v > 0);
  if (!filtered.length) return null;
  return Math.min(...filtered);
}

export default function ViewportMetricsProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const update = () => {
      const height = readViewportHeight();
      if (height) {
        document.documentElement.style.setProperty('--viewport-height', `${height}px`);
        const body = document.body;
        const diff = Math.abs(window.innerHeight - height);
        const threshold = 12; // px
        const shouldShow = diff > threshold;
        if (shouldShow) {
          document.documentElement.setAttribute('data-chrome-overlay-visible', 'true');
          body.setAttribute('data-chrome-overlay-visible', 'true');
        } else {
          document.documentElement.removeAttribute('data-chrome-overlay-visible');
          body.removeAttribute('data-chrome-overlay-visible');
        }
        window.dispatchEvent(new CustomEvent('viewport-height-change', { detail: height }));
      }
    };

    update();

    const resizeEvents = ['resize', 'orientationchange'];
    resizeEvents.forEach((evt) => window.addEventListener(evt, update, { passive: true }));

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update, { passive: true });
      vv.addEventListener('scroll', update, { passive: true });
    }

    return () => {
      resizeEvents.forEach((evt) => window.removeEventListener(evt, update));
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
    };
  }, []);

  return null;
}


