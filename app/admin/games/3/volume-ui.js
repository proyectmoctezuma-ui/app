// Control de volumen del juego 3 alineado con el comportamiento del juego 1.

export function initVolumeUI() {
  if (typeof window === 'undefined') return () => {};

  const ICON_MUTE = '/games/3/volume_system/icons/mute.svg';
  const ICON_UNMUTE = '/games/3/volume_system/icons/unmute.svg';

  const vs = window.VolumeSystem;
  if (!vs) return () => {};

  const $app = document.getElementById('app');
  if (!$app) return () => {};

  let $overlay = document.getElementById('volumeOverlay');
  let $panel = document.getElementById('volumePanel');

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
    `;
    $app.appendChild($panel);
  }

  const $muteBtn = $panel.querySelector('#vol-mute');
  const $muteIcon = $muteBtn?.querySelector('img');
  const $slider = $panel.querySelector('#vol-slider');

  const $btnRight = document.getElementById('btn-music-right');

  let $btnTop = document.getElementById('btn-music');
  if (!$btnTop) {
    const hudRight = document.querySelector('.hud-right') || document.querySelector('.topbar') || document.querySelector('.hud');
    if (hudRight) {
      $btnTop = document.createElement('button');
      $btnTop.id = 'btn-music';
      $btnTop.className = 'volume-toggle-btn';
      $btnTop.type = 'button';
      $btnTop.innerHTML = `<img alt="" src="${ICON_UNMUTE}">`;
      hudRight.prepend($btnTop);
    }
  }

  let lastNonZero = vs.get() > 0 ? vs.get() : 0.5;

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

  const renderTrigger = (btn, v) => {
    if (!btn) return;
    const icon = v > 0 ? ICON_UNMUTE : ICON_MUTE;
    btn.classList?.add('volume-toggle-btn');
    const img = btn.querySelector('img');
    if (img) {
      img.src = icon;
      img.alt = '';
    } else {
      btn.innerHTML = `<img src="${icon}" alt="">`;
    }
  };

  const updateAria = (v) => {
    const labelToggle = v > 0 ? 'Silenciar' : 'Activar sonido';
    try { $muteBtn?.setAttribute('aria-label', labelToggle); } catch {}
    try { $btnTop?.setAttribute('aria-label', `Volumen (${v > 0 ? 'activado' : 'silenciado'})`); } catch {}
    try { $btnRight?.setAttribute('aria-label', `Volumen (${v > 0 ? 'activado' : 'silenciado'})`); } catch {}
  };

  const syncFromVolume = (v) => {
    renderMuteIcon(v);
    renderTrigger($btnTop, v);
    renderTrigger($btnRight, v);
    updateAria(v);
    if ($slider && document.activeElement !== $slider) {
      $slider.value = String(v);
    }
  };

  $overlay.addEventListener('click', closePanel);

  const onTriggerToggleMute = () => {
    const cur = vs.get();
    if (cur > 0) { lastNonZero = cur; vs.set(0); }
    else { vs.set(lastNonZero || 0.5); }
  };

  let handleTopClick = null;
  let handleTopKeydown = null;
  if ($btnTop && !$btnTop.dataset.bound) {
    $btnTop.dataset.bound = '1';
    handleTopClick = () => {
      if ($panel.classList.contains('is-open')) {
        closePanel();
      } else {
        openPanel();
      }
    };
    handleTopKeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTopClick();
      }
    };
    $btnTop.addEventListener('click', handleTopClick);
    $btnTop.addEventListener('keydown', handleTopKeydown);
  }

  let handleRightClick = null;
  if ($btnRight && !$btnRight.dataset.bound) {
    $btnRight.dataset.bound = '1';
    handleRightClick = (e) => {
      e.preventDefault();
      if ($panel.classList.contains('is-open')) {
        onTriggerToggleMute();
      } else {
        openPanel();
      }
    };
    $btnRight.addEventListener('click', handleRightClick);
  }

  $slider?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    vs.set(v);
    if (v > 0) lastNonZero = v;
  });

  if ($muteBtn && !$muteBtn.dataset.bound) {
    $muteBtn.dataset.bound = '1';
    $muteBtn.addEventListener('click', () => {
      const cur = vs.get();
      if (cur > 0) {
        lastNonZero = cur;
        vs.set(0);
      } else {
        vs.set(lastNonZero || 0.5);
      }
    });
  }

  const unsub = vs.onChange(syncFromVolume);

  syncFromVolume(vs.get());
  if ($slider) $slider.value = String(vs.get());

  return () => {
    try { $overlay.removeEventListener('click', closePanel); } catch {}
    try {
      if (handleTopClick) $btnTop?.removeEventListener('click', handleTopClick);
      if (handleTopKeydown) $btnTop?.removeEventListener('keydown', handleTopKeydown);
      if ($btnTop && handleTopClick) delete $btnTop.dataset.bound;
    } catch {}
    try {
      if (handleRightClick) $btnRight?.removeEventListener('click', handleRightClick);
      if ($btnRight && handleRightClick) delete $btnRight.dataset.bound;
    } catch {}
    try { $slider?.removeEventListener('input', () => {}); } catch {}
    try { $muteBtn?.removeEventListener('click', () => {}); } catch {}
    try { unsub?.(); } catch {}
  };
}
