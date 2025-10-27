// UI del control de volumen (overlay + panel deslizante + botones disparadores)
// Inserta el DOM dentro de #app (no en <body>) para que los CSS Modules apliquen.
// Depende de window.VolumeSystem (initVolumeSystem) y se integra con AudioBridge si está.

export function initVolumeUI() {
  if (typeof window === 'undefined') return () => {};

  const ICON_MUTE   = '/games/1/volume_system/icons/mute.svg';
  const ICON_UNMUTE = '/games/1/volume_system/icons/unmute.svg';
  const ICON_MAX    = '/games/1/volume_system/icons/unmute.svg';

  const vs = window.VolumeSystem;
  if (!vs) return () => {};

  const $app = document.getElementById('app');
  if (!$app) return () => {};

  // ---------- Crear overlay + panel si no existen ----------
  let $overlay = document.getElementById('volumeOverlay');
  let $panel   = document.getElementById('volumePanel');

  if (!$overlay) {
    $overlay = document.createElement('div');
    $overlay.id = 'volumeOverlay';
    $app.appendChild($overlay);
  }

  if (!$panel) {
    $panel = document.createElement('div');
    $panel.id = 'volumePanel';
    $panel.innerHTML = `
      <button class="vol-btn" id="vol-mute" aria-label="Silenciar">
        <img alt="Mute/Unmute" />
      </button>
      <input type="range" class="vol-slider" id="vol-slider" min="0" max="1" step="0.01" />
      <button class="vol-btn" id="vol-max" aria-label="Volumen máximo">
        <img alt="Max" />
      </button>
    `;
    $app.appendChild($panel);
  }

  const $muteBtn   = $panel.querySelector('#vol-mute');
  const $muteIcon  = $muteBtn?.querySelector('img');
  const $maxBtn    = $panel.querySelector('#vol-max');
  const $maxIcon   = $maxBtn?.querySelector('img');
  const $slider    = $panel.querySelector('#vol-slider');

  // ---------- Disparadores ----------
  // 1) Desktop: botón existente en el panel derecho
  const $btnRight = document.getElementById('btn-music-right');

  // 2) Móvil: si no hay botón, crearlo en la HUD
  let $btnTop = document.getElementById('btn-music');
  if (!$btnTop) {
    const hudRight = document.querySelector('.hud-right');
    if (hudRight) {
      $btnTop = document.createElement('button');
      $btnTop.id = 'btn-music';
      $btnTop.className = 'btn ghost icon';
      $btnTop.type = 'button';
      $btnTop.innerHTML = `<img alt=""><span style="margin-left:6px">Volumen</span>`;
      hudRight.prepend($btnTop);
    }
  }

  // ---------- Estado ----------
  let lastNonZero = vs.get() > 0 ? vs.get() : 0.5;

  // ---------- Helpers UI ----------
  const openPanel = () => {
    $overlay.classList.add('is-open');
    $panel.classList.add('is-open');
  };
  const closePanel = () => {
    $overlay.classList.remove('is-open');
    $panel.classList.remove('is-open');
  };

  const renderMuteIcon = (v) => {
    if ($muteIcon) $muteIcon.src = v > 0 ? ICON_UNMUTE : ICON_MUTE;
  };
  const renderMaxIcon = () => {
    if ($maxIcon) $maxIcon.src = ICON_MAX || ICON_UNMUTE;
  };

  const renderTrigger = (btn, v) => {
    if (!btn) return;
    const icon = v > 0 ? ICON_UNMUTE : ICON_MUTE;
    // Si el botón ya tiene un <img>, actualízalo; si no, reemplaza su contenido
    const img = btn.querySelector('img');
    if (img) {
      img.src = icon;
    } else {
      btn.innerHTML = `<img src="${icon}" alt=""><span style="margin-left:6px">Volumen</span>`;
    }
  };

  const syncFromVolume = (v) => {
    renderMuteIcon(v);
    renderMaxIcon();
    renderTrigger($btnTop, v);
    renderTrigger($btnRight, v);
    if ($slider && document.activeElement !== $slider) {
      $slider.value = String(v);
    }
  };

  // ---------- Eventos ----------
  // Cerrar panel al tocar overlay
  $overlay.addEventListener('click', closePanel);

  // Helpers: toggle mute
  const onTriggerToggleMute = () => {
    const cur = vs.get();
    if (cur > 0) { lastNonZero = cur; vs.set(0); }
    else { vs.set(lastNonZero || 0.5); }
  };

  // Botón superior (HUD):
  // - click de teclado (Enter/Espacio) => toggle
  // - pulsación larga (>=450ms) => abre panel
  // - doble click / menú contextual => abre panel
  if ($btnTop) {
    let lpTimer = null; let lpFired = false; const LP_MS = 450;
    const clearLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    const onPD = () => { lpFired = false; clearLP(); lpTimer = setTimeout(() => { lpFired = true; openPanel(); }, LP_MS); };
    const onPU = () => { if (!lpFired) onTriggerToggleMute(); clearLP(); };
    $btnTop.addEventListener('pointerdown', onPD);
    $btnTop.addEventListener('pointerup', onPU);
    $btnTop.addEventListener('pointercancel', clearLP);
    $btnTop.addEventListener('pointerleave', clearLP);
    $btnTop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriggerToggleMute(); }
    });
    $btnTop.addEventListener('dblclick', (e) => { e.preventDefault(); openPanel(); });
    $btnTop.addEventListener('contextmenu', (e) => { e.preventDefault(); openPanel(); });
  }

  // Botón del panel derecho (desktop): abre panel como antes
  $btnRight?.addEventListener('click', openPanel);

  // Slider -> volumen
  $slider?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    vs.set(v);
    if (v > 0) lastNonZero = v;
  });

  // Mute toggle
  $muteBtn?.addEventListener('click', () => {
    const cur = vs.get();
    if (cur > 0) {
      lastNonZero = cur;
      vs.set(0);
    } else {
      vs.set(lastNonZero || 0.5);
    }
  });
  // Volumen máximo (85% del total real)
  $maxBtn?.addEventListener('click', () => {
    vs.set(0.85);
  });

  // Reaccionar a cambios externos de volumen
  const unsub = vs.onChange(syncFromVolume);

  // Primera sincronización UI
  syncFromVolume(vs.get());
  if ($slider) $slider.value = String(vs.get());

  // Cleanup
  return () => {
    try { $overlay.removeEventListener('click', closePanel); } catch {}
    try { $btnTop?.removeEventListener('click', openPanel); } catch {}
    try { $btnRight?.removeEventListener('click', openPanel); } catch {}
    try { $slider?.removeEventListener('input', () => {}); } catch {}
    try { $muteBtn?.removeEventListener('click', () => {}); } catch {}
    try { unsub?.(); } catch {}
    // Dejamos el DOM porque vive dentro del árbol del juego y Next lo desmonta al salir
  };
}
