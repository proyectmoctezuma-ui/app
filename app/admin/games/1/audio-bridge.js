// app/admin/games/1/audio-bridge.js
// Puente de audio: BGM + SFX (click), WebAudio (iOS), y binding con VolumeSystem.
// ESM, sin TypeScript ni Tailwind.

const CLICK_SFX_PATH = '/games/1/audio/click.mp3';
const BGM_PATH       = '/games/1/audio/background_music.mp3';
const CLICK_POOL_SIZE = 6;

let booted = false;
let audioCtx = null;
let masterGain = null;

let bgm = null;
let clickPool = [];

// -------- helpers WebAudio --------
function ensureCtx(vol = 0.5) {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = vol;
    masterGain.connect(audioCtx.destination);

    // Exponer opcional en VolumeSystem si no existe
    try {
      const VS = window.VolumeSystem;
      if (VS && !VS.ensureContext) {
        VS.ensureContext = () => {
          if (audioCtx?.state === 'suspended') audioCtx.resume().catch(()=>{});
          return audioCtx;
        };
      }
      if (VS && typeof VS.hasAudioContext === 'undefined') {
        VS.hasAudioContext = true;
      }
    } catch {}
  }

  // iOS suele arrancar "suspended"
  if (audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch {}
  }
  return audioCtx;
}

function attachToBus(mediaEl) {
  if (!audioCtx || !masterGain || !mediaEl) return false;
  try {
    if (mediaEl._awSrc) return true; // ya conectado
    const src = audioCtx.createMediaElementSource(mediaEl);
    src.connect(masterGain);
    mediaEl._awSrc = src;
    // hints iOS
    mediaEl.setAttribute('playsinline', '');
    mediaEl.setAttribute('webkit-playsinline', '');
    mediaEl.muted = false;
    return true;
  } catch {
    // Safari/Chrome arrojan error si ya se conectó antes; ignoramos
    return false;
  }
}

function unlockOnce() {
  const VS = window.VolumeSystem;
  const vol = VS?.get?.() ?? 0.5;
  ensureCtx(vol);
  // Conectar todos los audios al bus
  attachToBus(bgm);
  clickPool.forEach(a => attachToBus(a));

  // Limpia listeners
  document.removeEventListener('touchstart', unlockOnce, {capture:false});
  document.removeEventListener('pointerdown', unlockOnce, {capture:false});
  document.removeEventListener('mousedown', unlockOnce, {capture:false});
  document.removeEventListener('keydown', unlockOnce, {capture:false});
}

// -------- API pública --------
export function initAudioBridge() {
  if (typeof window === 'undefined' || booted) return getAPI();
  booted = true;

  const VS = window.VolumeSystem || { get: () => 0.5, onChange: () => () => {} };
  const initialVol = VS.get?.() ?? 0.5;

  // BGM
  bgm = new Audio(BGM_PATH);
  bgm.loop = true;
  bgm.preload = 'auto';
  bgm.setAttribute('playsinline', '');
  bgm.setAttribute('webkit-playsinline', '');
  bgm.volume = initialVol;

  // Click pool
  clickPool = Array.from({ length: CLICK_POOL_SIZE }, () => {
    const a = new Audio(CLICK_SFX_PATH);
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    a.volume = initialVol;
    return a;
  });

  // Intento de adjuntar al bus (si el usuario todavía no tocó, quedará para unlockOnce)
  ensureCtx(initialVol);
  attachToBus(bgm);
  clickPool.forEach(a => attachToBus(a));

  // Desbloquear contexto en primer gesto (iOS)
  document.addEventListener('touchstart',  unlockOnce, { once:true, passive:true });
  document.addEventListener('pointerdown', unlockOnce, { once:true });
  document.addEventListener('mousedown',   unlockOnce, { once:true });
  document.addEventListener('keydown',     unlockOnce, { once:true });

  // Reaccionar a cambios de volumen
  VS.onChange?.((v) => {
    if (masterGain) {
      // Control central del volumen cuando hay WebAudio
      try { masterGain.gain.value = v; } catch {}
      // deja los elementos a 1 para que el gain mande
      try { bgm.volume = 1; } catch {}
      clickPool.forEach(a => { try { a.volume = 1; } catch {} });
    } else {
      // Fallback sin WebAudio
      try { bgm.volume = v; } catch {}
      clickPool.forEach(a => { try { a.volume = v; } catch {} });
    }
  });

  // Señal opcional de "audio listo"
  try { window.dispatchEvent(new Event('audio:ready')); } catch {}

  // Exponer helpers globales (opcionales)
  try { window.AudioBridge = getAPI(); } catch {}

  return getAPI();
}

function playClick() {
  // busca un canal libre; si ninguno, usa el 0
  const a = clickPool.find(x => x.paused) || clickPool[0];
  try {
    a.currentTime = 0;

    // Si estamos en bus WebAudio, el volumen lo maneja el GainNode → deja el elemento en 1
    if (masterGain && a._awSrc) a.volume = 1;

    a.play().catch(()=>{});
  } catch {}
}

function setMusic(on) {
  if (!bgm) return;
  if (on) {
    // asegurar contexto antes de play (iOS)
    ensureCtx();
    attachToBus(bgm);
    bgm.play().catch(()=>{});
  } else {
    try { bgm.pause(); } catch {}
  }
}

function toggleMusic() {
  if (!bgm) return;
  setMusic(bgm.paused);
}

function getBgm() { return bgm; }

function getAPI() {
  return { playClick, setMusic, toggleMusic, getBgm };
}
