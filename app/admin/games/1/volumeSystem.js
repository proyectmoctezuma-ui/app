// app/admin/games/1/volumeSystem.js
// Singleton de volumen con WebAudio (iOS-friendly), pub/sub y persistencia.
// ESM, sin TypeScript.

const KEY = 'volume.master';

let singleton = null;

export function initVolumeSystem() {
  if (typeof window === 'undefined') return null;
  if (singleton) return singleton;

  // ------------------ Estado ------------------
  let _vol = 0.5;
  const subs = [];

  // Carga persistida
  try {
    const saved = parseFloat(sessionStorage.getItem(KEY));
    if (!Number.isNaN(saved)) _vol = clamp(saved, 0, 1);
  } catch {}

  // WebAudio
  let audioCtx = null;
  let masterGain = null;
  let unlocked = false;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function hasWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  function ensureCtx() {
    if (!hasWebAudio()) return null;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = _vol;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      // algunos navegadores necesitan resume en gesto
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function unlockOnce() {
    try {
      ensureCtx();
      unlocked = true;
      window.removeEventListener('pointerdown', unlockOnce, { capture: false });
      window.removeEventListener('touchstart', unlockOnce, { capture: false });
      window.removeEventListener('mousedown', unlockOnce, { capture: false });
      window.removeEventListener('keydown', unlockOnce, { capture: false });
      try { window.dispatchEvent(new Event('volume:unlocked')); } catch {}
    } catch {}
  }

  // Desbloqueo por primer gesto del usuario
  window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
  window.addEventListener('touchstart', unlockOnce, { once: true, passive: true });
  window.addEventListener('mousedown', unlockOnce, { once: true });
  window.addEventListener('keydown', unlockOnce, { once: true });

  const VolumeSystem = {
    // Indicadores
    get hasAudioContext() { return !!audioCtx; },
    get isUnlocked() { return unlocked; },

    // Valor 0..1
    get() { return _vol; },

    set(v) {
      const nv = clamp(Number(v), 0, 1);
      if (!Number.isFinite(nv) || nv === _vol) return;
      _vol = nv;

      // Persistir
      try { sessionStorage.setItem(KEY, String(nv)); } catch {}

      // Aplicar al master if available
      if (masterGain) {
        try { masterGain.gain.value = nv; } catch {}
      }

      // Actualiza <audio> no envueltos
      try {
        document.querySelectorAll('audio').forEach(a => {
          if (!a._vsWrapped) a.volume = nv;
        });
      } catch {}

      // Notificar subs
      subs.forEach(fn => { try { fn(nv); } catch {} });

      // Evento global
      try { window.dispatchEvent(new CustomEvent('volume:change', { detail: nv })); } catch {}
    },

    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      subs.push(fn);
      return () => {
        const i = subs.indexOf(fn);
        if (i >= 0) subs.splice(i, 1);
      };
    },

    /**
     * Conecta un <audio> al bus maestro (recomendado para iOS).
     * Devuelve true si quedó conectado; false si no se pudo (p.ej. doble conexión).
     */
    attachMedia(mediaEl) {
      if (!mediaEl) return false;
      try {
        // Asegura volumen inicial y atributos para iOS
        mediaEl.volume = _vol;
        mediaEl.setAttribute?.('playsinline', '');
        mediaEl.setAttribute?.('webkit-playsinline', '');
        mediaEl.muted = false;

        const ctx = ensureCtx();
        if (!ctx) { mediaEl._vsWrapped = true; return true; } // sin WebAudio, al menos marca volumen

        // Evita doble fuente (Safari truena si se crea 2 veces)
        if (mediaEl._vsNode) return true;

        const src = ctx.createMediaElementSource(mediaEl);
        src.connect(masterGain);
        mediaEl._vsNode = src;
        mediaEl._vsWrapped = true;
        return true;
      } catch {
        return false;
      }
    },

    /** Crea/init el contexto (útil si quieres abrir el panel y garantizar audio) */
    ensureContext() {
      return !!ensureCtx();
    }
  };

  // Exponer y avisar listo
  singleton = VolumeSystem;
  try { window.VolumeSystem = VolumeSystem; } catch {}
  try { window.dispatchEvent(new Event('volume:ready')); } catch {}

  return VolumeSystem;
}
