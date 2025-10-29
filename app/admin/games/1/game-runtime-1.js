// Runtime del rompecabezas para Next.js (con prompt de inicio y frame full)

export function initGame() {
  if (typeof window === 'undefined') return () => {};

  // --------------------------
  // Config & helpers
  // --------------------------
  const GAME_ID = 1;
  const GAME_TITLE = 'Construyendo el propósito';
  const ASSET_DIR = '/games/1/assets';
  const AUDIO_DIR = '/games/1/audio';
  const CANDIDATE_EXTS = ['.jpg', '.png', '.jpeg'];
  const MAX_PROBE_ROWS = 26; // A..Z
  const MAX_PROBE_COLS = 60;

  const TIME_LIMIT = 120;         // 2:00
  const SNAP_TOL_FACTOR = 0.20;
  const RADIUS_PX = 14;
  const OVERLAY_ALPHA = 0.12;
  const DESKTOP_BLOCK_RIGHT_BAND = true;
  const MOBILE_BLOCK_TOP_BAND = false;
  const OBSTRUCT_MARGIN = 10;
  const TILT_DEG = 10;

  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
  const parseDeg = (str) => (str ? (parseFloat(String(str).replace('deg', '')) || 0) : 0);
  const randRange = (a, b) => a + Math.random() * (b - a);
  const randTilt = () => `${((Math.random() * 2 - 1) * TILT_DEG).toFixed(2)}deg`;
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const rectsOverlap = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const idByRowCol = (r, c, rows, cols) => (r < 0 || c < 0 || r >= rows || c >= cols) ? null : `${String.fromCharCode(65 + r)}${c + 1}`;

  // --------------------------
  // DOM refs
  // --------------------------
  const $app = document.getElementById('app');
  const $boardWrap = document.getElementById('board-wrap');
  const $boardFrame = document.getElementById('board-frame');
  const $board = document.getElementById('board');
  const $guideGrid = document.getElementById('guide-grid');

  const $hud = document.querySelector('.hud');
  const $hudRight = document.querySelector('.hud-right');
  const $panelCard = document.querySelector('.side-panel .side-card');

  const $mm = document.getElementById('time-mm');
  const $ss = document.getElementById('time-ss');
  const $mmR = document.getElementById('time-mm-right');
  const $ssR = document.getElementById('time-ss-right');
  const $progress = document.getElementById('progress-bar');
  const $progressR = document.getElementById('progress-bar-right');
  const $piecesCount = document.getElementById('pieces-count');
  const $piecesCountR = document.getElementById('pieces-count-right');

  const $banner = document.getElementById('end-banner');
  const $finalScore = document.getElementById('final-score');
  const $btnEndAct = document.getElementById('btn-end-action');
  const $btnRestart = document.getElementById('btn-reset'); // opcional en HUD mobile

  if (!$boardWrap || !$boardFrame || !$board) {
    console.error('[game-runtime] Faltan nodos base (#board-wrap/#board-frame/#board).');
    return () => {};
  }

  // Asegura que el frame ocupe todo su contenedor (evita tablero mini)
  $boardFrame.style.width = '100%';
  $boardFrame.style.height = '100%';

  // --------------------------
  // Estado
  // --------------------------
  const cs = getComputedStyle($board);
  const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

  const state = {
    rows: parseInt(cs.getPropertyValue('--rows')) || 4,
    cols: parseInt(cs.getPropertyValue('--cols')) || 6,
    ext: '.jpg',
    baseCellW: numOr(cs.getPropertyValue('--cellW'), 120),
    baseCellH: numOr(cs.getPropertyValue('--cellH'), 120),
    baseBoardW: 0,
    baseBoardH: 0,
    scale: 1,

    pieces: new Map(),
    images: [],
    lockedCount: 0,

    draggingId: null,
    started: false,

    timeLeft: TIME_LIMIT,
    timerId: null,

    _rafDragging: false,
    _rafPieceId: null,
    _rafLastClientX: 0,
    _rafLastClientY: 0,

    // audio
    clickPool: [],
    bgm: null,

    _cleanup: null
  };

  // --------------------------
  // Audio mínimo
  // --------------------------
  const CLICK_SFX_PATH = `${AUDIO_DIR}/click.mp3`;
  function makeClickPool() {
    state.clickPool = Array.from({ length: 6 }, () => {
      const a = new Audio(CLICK_SFX_PATH);
      a.preload = 'auto';
      return a;
    });
  }
  function playClick() {
    const a = state.clickPool.find(x => x.paused) || state.clickPool[0];
    if (!a) return;
    try {
      a.currentTime = 0;
      a.volume = (window.VolumeSystem?.get?.() ?? 0.5);
      a.play().catch(() => {});
    } catch {}
  }
  function setupBGM() {
    state.bgm = new Audio(`${AUDIO_DIR}/background_music.mp3`);
    state.bgm.loop = true;
    state.bgm.preload = 'auto';
    state.bgm.volume = (window.VolumeSystem?.get?.() ?? 0.5);
    window.VolumeSystem?.onChange?.((v) => { if (state.bgm) state.bgm.volume = v; });
  }
  function setMusic(on) {
    if (!state.bgm) return;
    if (on) state.bgm.play().catch(() => {}); else state.bgm.pause();
  }

  // --------------------------
  // Utils de assets
  // --------------------------
  function imgExists(src) {
    return new Promise(res => {
      const i = new Image();
      i.onload = () => res(true);
      i.onerror = () => res(false);
      i.src = src;
    });
  }
  async function chooseWorkingExt() {
    for (const ext of CANDIDATE_EXTS) {
      const ok = await imgExists(`${ASSET_DIR}/A1${ext}`);
      if (ok) return ext;
    }
    return null;
  }
  async function autodetectGridAndExt() {
    const ext = await chooseWorkingExt();
    if (!ext) {
      console.warn('[game-runtime] No encontré A1 con .jpg/.png/.jpeg. Uso defaults 4x6 .jpg.');
      return { rows: 4, cols: 6, ext: '.jpg' };
    }
    let rows = 0;
    for (let r = 0; r < MAX_PROBE_ROWS; r++) {
      const letter = String.fromCharCode(65 + r);
      const ok = await imgExists(`${ASSET_DIR}/${letter}1${ext}`);
      if (!ok) break; rows++;
    }
    if (rows === 0) rows = 4;

    let cols = 0;
    for (let c = 1; c <= MAX_PROBE_COLS; c++) {
      const ok = await imgExists(`${ASSET_DIR}/A${c}${ext}`);
      if (!ok) break; cols++;
    }
    if (cols === 0) cols = 6;
    return { rows, cols, ext };
  }
  function generateAssetList(rows, cols, ext) {
    const list = [];
    for (let r = 0; r < rows; r++) {
      const letter = String.fromCharCode(65 + r);
      for (let c = 0; c < cols; c++) {
        const id = `${letter}${c + 1}`;
        list.push({ id, row: r, col: c, src: `${ASSET_DIR}/${id}${ext}` });
      }
    }
    return list;
  }
  function loadImageDims(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight });
      i.onerror = () => rej(new Error('loadImageDims'));
      i.src = src;
    });
  }

  // --------------------------
  // Layout helpers
  // --------------------------
  function fitBoard() {
  // dimensiones base del board (no escaladas)
  state.baseBoardW = state.baseCellW * state.cols;
  state.baseBoardH = state.baseCellH * state.rows;

  // tamaño disponible dentro del frame
  const frameRect = $boardFrame.getBoundingClientRect();
  const availW = Math.max(50, frameRect.width);
  const availH = Math.max(50, frameRect.height);

  const sx = availW / state.baseBoardW;
  const sy = availH / state.baseBoardH;
  const scale = Math.max(0.0001, Math.min(sx, sy)) * 0.995;
  state.scale = scale;

  const scaledW = state.baseBoardW * scale;
  const scaledH = state.baseBoardH * scale;

  // offsets para centrar dentro del frame
  const offsetX = Math.max(0, (availW - scaledW) / 2);
  const vBias   = isDesktop() ? 0.5 : 0.25; // centrado en desktop, un poco más arriba en móvil
  const offsetY = Math.max(0, (availH - scaledH)) * vBias;

  // fija tamaño base (para guías/snapping) y centra con translate + scale
  $board.style.width  = `${state.baseBoardW}px`;
  $board.style.height = `${state.baseBoardH}px`;
  $board.style.transformOrigin = 'top left';
  $board.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

  // evita que márgenes del frame interfieran con el centrado
  $boardFrame.style.margin = '0';

  $board.classList.remove('grid-strong', 'focus-drag');
}



  function buildGuideGrid() {
  $guideGrid.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', state.baseBoardW);
  svg.setAttribute('height', state.baseBoardH);
  svg.setAttribute('viewBox', `0 0 ${state.baseBoardW} ${state.baseBoardH}`);
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';

  const g = document.createElementNS(svgNS, 'g');
  g.setAttribute('class', 'grid-lines');
  g.setAttribute('vector-effect', 'non-scaling-stroke');

  for (let c = 1; c < state.cols; c++) {
    const x = c * state.baseCellW;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', 0);
    line.setAttribute('x2', x); line.setAttribute('y2', state.baseBoardH);
    g.appendChild(line);
  }
  for (let r = 1; r < state.rows; r++) {
    const y = r * state.baseCellH;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', 0); line.setAttribute('y1', y);
    line.setAttribute('x2', state.baseBoardW); line.setAttribute('y2', y);
    g.appendChild(line);
  }

  svg.appendChild(g);
  $guideGrid.appendChild(svg);

  // Asegura que por defecto esté oculta hasta que el usuario arrastre.
  $board.classList.remove('show-grid', 'grid-strong', 'focus-drag');
}


  function getFreeSpacesAroundFrame() {
    const wrapRect = $boardWrap.getBoundingClientRect();
    const frameRect = $boardFrame.getBoundingClientRect();

    const left = Math.max(0, frameRect.left - wrapRect.left) / state.scale;
    const right = Math.max(0, wrapRect.right - frameRect.right) / state.scale;
    const top = Math.max(0, frameRect.top - wrapRect.top) / state.scale;
    const bottom = Math.max(0, wrapRect.bottom - frameRect.bottom) / state.scale;

    return { left, right, top, bottom, wrapRect, frameRect };
  }
  function getDragClampRect() {
    const spaces = getFreeSpacesAroundFrame();
    const rightSpace = (isDesktop() && DESKTOP_BLOCK_RIGHT_BAND) ? 0 : spaces.right;
    const topSpace = (!isDesktop() && MOBILE_BLOCK_TOP_BAND) ? 0 : spaces.top;
    return {
      minX: -spaces.left,
      maxX: state.baseBoardW - state.baseCellW + rightSpace,
      minY: -topSpace,
      maxY: state.baseBoardH - state.baseCellH + spaces.bottom,
    };
  }
  function ensureWithinBounds(piece) {
    const { minX, maxX, minY, maxY } = getDragClampRect();
    piece.x = clamp(piece.x, minX, maxX);
    piece.y = clamp(piece.y, minY, maxY);
  }
  function resolveObstructions(animate = true) {
    const obstacles = [];
    const isShown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };

    if (isDesktop() && isShown($panelCard)) obstacles.push($panelCard.getBoundingClientRect());
    if (!isDesktop() && isShown($hud)) obstacles.push($hud.getBoundingClientRect());

    const wrapRect = $boardWrap.getBoundingClientRect();

    for (const p of state.pieces.values()) {
      if (p.locked) continue;
      let prect = p.el.getBoundingClientRect();

      let dx = 0, dy = 0;

      for (const obs of obstacles) {
        if (!rectsOverlap(prect, obs)) continue;

        const leftShift = prect.right - obs.left + OBSTRUCT_MARGIN;
        const rightShift = obs.right - prect.left + OBSTRUCT_MARGIN;
        const topShift = prect.bottom - obs.top + OBSTRUCT_MARGIN;
        const bottomShift = obs.bottom - prect.top + OBSTRUCT_MARGIN;

        const candidates = [
          { axis: 'x', val: -leftShift, mag: Math.abs(leftShift) },
          { axis: 'x', val: +rightShift, mag: Math.abs(rightShift) },
          { axis: 'y', val: -topShift, mag: Math.abs(topShift) },
          { axis: 'y', val: +bottomShift, mag: Math.abs(bottomShift) }
        ].sort((a, b) => a.mag - b.mag);

        const best = candidates[0];
        if (best.axis === 'x') dx += best.val; else dy += best.val;

        prect = {
          ...prect,
          left: prect.left + (best.axis === 'x' ? best.val : 0),
          right: prect.right + (best.axis === 'x' ? best.val : 0),
          top: prect.top + (best.axis === 'y' ? best.val : 0),
          bottom: prect.bottom + (best.axis === 'y' ? best.val : 0),
        };
      }

      if (prect.left < wrapRect.left)  dx += (wrapRect.left - prect.left + OBSTRUCT_MARGIN);
      if (prect.right > wrapRect.right) dx -= (prect.right - wrapRect.right + OBSTRUCT_MARGIN);
      if (prect.top < wrapRect.top)    dy += (wrapRect.top - prect.top + OBSTRUCT_MARGIN);
      if (prect.bottom > wrapRect.bottom) dy -= (prect.bottom - wrapRect.bottom + OBSTRUCT_MARGIN); // <- corregido

      if (dx !== 0 || dy !== 0) {
        const nx = (p.x ?? 0) + dx / state.scale;
        const ny = (p.y ?? 0) + dy / state.scale;
        p.x = nx; p.y = ny;
        ensureWithinBounds(p);
        if (animate) p.el.style.transition = 'transform 260ms ease, opacity 160ms ease';
        applyTransformTo(p.el, p.x, p.y, p.rotation ?? 0);
      }
    }
  }

  // --------------------------
  // Piezas
  // --------------------------
  function applyTransformTo(el, x, y, rotDeg = 0) {
    el.style.setProperty('--tx', `${x}px`);
    el.style.setProperty('--ty', `${y}px`);
    el.style.setProperty('--rot', `${rotDeg}deg`);
  }
  function setOverlay(el, alpha) {
    el.style.setProperty('--overlay-alpha', alpha.toString());
  }
  function destroyPieces() {
    $board.querySelectorAll('.piece').forEach(n => n.remove());
    state.pieces.clear();
    state.lockedCount = 0;
    updateCompletionUI();
    updatePiecesCountUI();
  }
  function spawnPieces() {
    destroyPieces(); // evita duplicados
    const frag = document.createDocumentFragment();
    for (const meta of state.images) {
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.id = meta.id;
      el.style.setProperty('--rot', randTilt());
      el.style.setProperty('--scale-extra', '1');
      el.style.borderRadius = `${RADIUS_PX}px`;

      const img = document.createElement('img');
      img.alt = meta.id;
      img.src = meta.src;
      el.appendChild(img);

      const p = { id: meta.id, row: meta.row, col: meta.col, x: 0, y: 0, rotation: parseDeg(el.style.getPropertyValue('--rot')) || 0, el, locked: false };
      state.pieces.set(meta.id, p);

      el.addEventListener('pointerdown', onPointerDown);
      frag.appendChild(el);
    }
    $board.appendChild(frag);
  }
  function randomScatter() {
    const spaces = getFreeSpacesAroundFrame();

    const leftAvail = spaces.left > state.baseCellW * 0.6;
    const rightAvail = spaces.right > state.baseCellW * 0.6 && !(isDesktop() && DESKTOP_BLOCK_RIGHT_BAND);
    const topAvail = spaces.top > state.baseCellH * 0.6 && !(!isDesktop() && MOBILE_BLOCK_TOP_BAND);
    const bottomAvail = spaces.bottom > state.baseCellH * 0.6;

    const bands = [];
    if (leftAvail) bands.push('left');
    if (rightAvail) bands.push('right');
    if (topAvail) bands.push('top');
    if (bottomAvail) bands.push('bottom');

    for (const p of state.pieces.values()) {
      let x, y;
      if (bands.length) {
        let band = bands[Math.floor(Math.random() * bands.length)];
        if (!isDesktop()) {
          const tb = ['top', 'bottom'].filter(b => bands.includes(b));
          if (tb.length) band = tb[Math.floor(Math.random() * tb.length)];
        }

        if (band === 'left') {
          const minX = -spaces.left, maxX = Math.min(-state.baseCellW * 0.2, 0);
          x = randRange(minX, maxX);
          y = randRange(-spaces.top, state.baseBoardH - state.baseCellH + spaces.bottom);
        } else if (band === 'right') {
          const minX = Math.max(state.baseBoardW - state.baseCellW * 0.8, state.baseBoardW - state.baseCellW);
          const maxX = state.baseBoardW - state.baseCellW + spaces.right;
          x = randRange(minX, Math.max(minX, maxX));
          y = randRange(-spaces.top, state.baseBoardH - state.baseCellH + spaces.bottom);
        } else if (band === 'top') {
          const minY = -spaces.top, maxY = Math.min(-state.baseCellH * 0.2, 0);
          y = randRange(minY, maxY);
          let minX = -spaces.left;
          let maxX = state.baseBoardW - state.baseCellW + spaces.right;
          if (isDesktop() && DESKTOP_BLOCK_RIGHT_BAND) maxX -= state.baseCellW * 0.4;
          x = randRange(minX, Math.max(minX, maxX));
        } else { // bottom
          const minY = Math.max(state.baseBoardH - state.baseCellH * 0.8, state.baseBoardH - state.baseCellH);
          const maxY = state.baseBoardH - state.baseCellH + spaces.bottom;
          y = randRange(minY, Math.max(minY, maxY));
          let minX = -spaces.left;
          let maxX = state.baseBoardW - state.baseCellW + spaces.right;
          if (isDesktop() && DESKTOP_BLOCK_RIGHT_BAND) maxX -= state.baseCellW * 0.4;
          x = randRange(minX, Math.max(minX, maxX));
        }
      } else {
        x = Math.random() * (state.baseBoardW - state.baseCellW);
        y = Math.random() * (state.baseBoardH - state.baseCellH);
      }

      p.x = x; p.y = y;
      p.rotation = parseDeg(randTilt());
      applyTransformTo(p.el, p.x, p.y, p.rotation);
      setOverlay(p.el, OVERLAY_ALPHA);
      applyCornerRadius(p);
    }
  }

  // --------------------------
  // Drag & Snap
  // --------------------------
  let dragCtx = null;
  function onPointerDown(e) {
    const id = e.currentTarget?.dataset?.id;
    const piece = state.pieces.get(id);
    if (!piece || piece.locked || !state.started) return;

    state.draggingId = id;
    dragCtx = { id, startX: e.clientX, startY: e.clientY, baseX: piece.x, baseY: piece.y, pointerId: e.pointerId };

    $board.classList.add('show-grid', 'grid-strong', 'focus-drag');

    piece.el.setPointerCapture(e.pointerId);
    piece.el.classList.add('dragging');

    piece.el.style.transition = 'transform 0s, border-radius var(--snap-duration) ease, filter 200ms ease';
    applyTransformTo(piece.el, piece.x, piece.y, piece.rotation);

    state._rafPieceId = id;
    state._rafLastClientX = e.clientX;
    state._rafLastClientY = e.clientY;
    if (!state._rafDragging) { state._rafDragging = true; requestAnimationFrame(_dragRAF); }

    piece.el.addEventListener('pointermove', onPointerMove);
    piece.el.addEventListener('pointerup', onPointerUp);
    piece.el.addEventListener('pointercancel', onPointerCancel);
  }
  function onPointerMove(e) {
    if (!dragCtx) return;
    state._rafLastClientX = e.clientX;
    state._rafLastClientY = e.clientY;
  }
  function onPointerUp(e) { finishDrag(e); }
  function onPointerCancel(e) { finishDrag(e); }

  function _dragRAF() {
    if (!state._rafDragging || !dragCtx) return;

    const piece = state.pieces.get(dragCtx.id);
    if (piece) {
      const dxBoard = (state._rafLastClientX - dragCtx.startX) / state.scale;
      const dyBoard = (state._rafLastClientY - dragCtx.startY) / state.scale;

      const { minX, maxX, minY, maxY } = getDragClampRect();
      const nx = clamp(dragCtx.baseX + dxBoard, minX, maxX);
      const ny = clamp(dragCtx.baseY + dyBoard, minY, maxY);

      piece.x = nx; piece.y = ny;
      applyTransformTo(piece.el, piece.x, piece.y, piece.rotation);
    }

    requestAnimationFrame(_dragRAF);
  }
  function finishDrag(e) {
    if (!dragCtx) return;
    const piece = state.pieces.get(dragCtx.id);
    if (!piece) return;

    piece.el.classList.remove('dragging');
    piece.el.releasePointerCapture?.(dragCtx.pointerId);
    piece.el.removeEventListener('pointermove', onPointerMove);
    piece.el.removeEventListener('pointerup', onPointerUp);
    piece.el.removeEventListener('pointercancel', onPointerCancel);

    piece.el.style.transition =
      'transform var(--snap-duration) ease, border-radius var(--snap-duration) ease, filter 200ms ease, opacity 160ms ease';
    $board.classList.remove('grid-strong', 'focus-drag');

    if (state._rafPieceId === dragCtx.id) { state._rafDragging = false; state._rafPieceId = null; }

    const targetX = piece.col * state.baseCellW;
    const targetY = piece.row * state.baseCellH;
    const tol = Math.min(state.baseCellW, state.baseCellH) * SNAP_TOL_FACTOR;
    const dist = Math.hypot(piece.x - targetX, piece.y - targetY);

    if (dist <= tol) {
      piece.locked = true;
      piece.x = targetX; piece.y = targetY;
      piece.rotation = 0;
      piece.el.classList.add('locked');
      applyTransformTo(piece.el, piece.x, piece.y, 0);
      piece.el.classList.add('snap-pulse');

      setOverlay(piece.el, 0);
      state.lockedCount++;
      updateCompletionUI();
      updatePiecesCountUI();

      applyCornerRadius(piece);
      forEachNeighbor(piece, (np) => applyCornerRadius(np));

      setTimeout(() => piece.el.classList.remove('snap-pulse'), 380);
      playClick();

      if (state.lockedCount >= state.images.length) endGame(true);
    } else {
      ensureWithinBounds(piece);
      applyTransformTo(piece.el, piece.x, piece.y, piece.rotation);
    }

    state.draggingId = null;
    dragCtx = null;
  }
  function forEachNeighbor(piece, fn) {
    const dirs = [{ dr: -1, dc: 0 }, { dr: 0, dc: +1 }, { dr: +1, dc: 0 }, { dr: 0, dc: -1 }];
    for (const d of dirs) {
      const r = piece.row + d.dr, c = piece.col + d.dc;
      if (r < 0 || c < 0 || r >= state.rows || c >= state.cols) continue;
      const id = idByRowCol(r, c, state.rows, state.cols);
      const np = state.pieces.get(id);
      if (np && np.locked) fn(np);
    }
  }
  function applyCornerRadius(piece) {
    const R = RADIUS_PX;
    const corners = { tl: R, tr: R, br: R, bl: R };

    const up = state.pieces.get(idByRowCol(piece.row - 1, piece.col, state.rows, state.cols));
    const right = state.pieces.get(idByRowCol(piece.row, piece.col + 1, state.rows, state.cols));
    const down = state.pieces.get(idByRowCol(piece.row + 1, piece.col, state.rows, state.cols));
    const left = state.pieces.get(idByRowCol(piece.row, piece.col - 1, state.rows, state.cols));

    if (up && up.locked)   { corners.tl = 0; corners.tr = 0; }
    if (right && right.locked){ corners.tr = 0; corners.br = 0; }
    if (down && down.locked){ corners.bl = 0; corners.br = 0; }
    if (left && left.locked){ corners.tl = 0; corners.bl = 0; }

    piece.el.style.borderTopLeftRadius = corners.tl + 'px';
    piece.el.style.borderTopRightRadius = corners.tr + 'px';
    piece.el.style.borderBottomRightRadius = corners.br + 'px';
    piece.el.style.borderBottomLeftRadius = corners.bl + 'px';

    const hasNeighbor = (up && up.locked) || (right && right.locked) || (down && down.locked) || (left && left.locked);
    setOverlay(piece.el, hasNeighbor ? 0 : OVERLAY_ALPHA);
  }

  // --------------------------
  // Timer & Banner
  // --------------------------
  function updateTimerLabel(sec) {
    const m = Math.max(0, Math.floor(sec / 60));
    const s = Math.max(0, sec % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if ($mm) $mm.textContent = mm; if ($ss) $ss.textContent = ss;
    if ($mmR) $mmR.textContent = mm; if ($ssR) $ssR.textContent = ss;
  }
  function updateCompletionUI() {
    const total = state.images.length || 1;
    const ratio = state.lockedCount / total;
    const pct = `${Math.round(ratio * 100)}%`;
    if ($progress) $progress.style.width = pct;
    if ($progressR) $progressR.style.width = pct;
  }
  function updatePiecesCountUI() {
    const txt = `${state.lockedCount}/${state.images.length}`;
    if ($piecesCount) $piecesCount.textContent = txt;
    if ($piecesCountR) $piecesCountR.textContent = txt;
  }
  function startTimer(totalSeconds) {
    state.timeLeft = totalSeconds;
    updateTimerLabel(state.timeLeft);
    state.started = true;
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.timeLeft--;
      updateTimerLabel(state.timeLeft);
      if (state.timeLeft <= 0) { stopTimer(); endGame(false); }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }
  async function autoCompleteRemaining() {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const notLocked = Array.from(state.pieces.values()).filter(p => !p.locked);
    for (let i = 0; i < notLocked.length; i++) {
      const p = notLocked[i];
      p.x = p.col * state.baseCellW; p.y = p.row * state.baseCellH; p.rotation = 0; p.locked = true;
      p.el.classList.add('locked'); setOverlay(p.el, 0);
      applyTransformTo(p.el, p.x, p.y, 0); p.el.style.filter = 'grayscale(1)';
      applyCornerRadius(p); forEachNeighbor(p, (np) => applyCornerRadius(np));
      await delay(18);
    }
    state.lockedCount = state.images.length;
    updateCompletionUI(); updatePiecesCountUI();
  }
  function showEndBanner(won, score) {
    const cfg = won
      ? { title: '¡Completado!', body: '¡Felicidades! Has logrado construir Nuestro Propósito', button: 'Continuar' }
      : { title: '¡Tiempo!', body: 'Te invitamos a que sigas contribuyendo al logro de Nuestro Propósito', button: 'Continuar' };
    const $title = document.getElementById('end-title');
    const $endExtra = document.getElementById('end-extra');
    if ($title) $title.textContent = cfg.title;
    if ($endExtra) $endExtra.textContent = cfg.body;
    if ($finalScore) $finalScore.textContent = String(score);
    if ($btnEndAct) { $btnEndAct.hidden = false; $btnEndAct.textContent = cfg.button; }
    if ($banner) { $banner.hidden = false; void $banner.offsetWidth; $banner.classList.add('visible'); }
  }
  function hideEndBanner() {
    if (!$banner) return;
    $banner.classList.remove('visible');
    setTimeout(() => { $banner.hidden = true; }, 320);
  }
  async function endGame(won) {
    stopTimer();
    state.started = false;
    const ratio = state.lockedCount / (state.images.length || 1);
    const score = Math.round(40 * ratio);
    if (!won) await autoCompleteRemaining();
    try { state.lastScore = score; } catch {}
    showEndBanner(won, score);
  }

  // --------------------------
  // Start Overlay (prompt)
  // --------------------------
  function ensureStartOverlay() {
    let overlay = document.getElementById('start-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.className = 'open'; // visible por defecto
    overlay.innerHTML = `
      <div class="start-backdrop"></div>
      <div class="start-content">
        <h2>Construyendo el Propósito</h2>
        <p>Arma el rompecabezas arrastrando las piezas a su lugar en el menor tiempo posible.</p>
        <div class="start-actions">
          <button id="btn-start-game" class="btn primary">Iniciar Juego</button>
        </div>
      </div>
    `;
    // Lo anclamos dentro del contenedor del juego (.scope) para que apliquen los estilos del módulo
    ($app || document.body).appendChild(overlay);
    return overlay;
  }
  function closeStartOverlay() {
    const overlay = document.getElementById('start-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
  function startGameFromPrompt() {
    try { setMusic(true); } catch {}
    startTimer(TIME_LIMIT);
  }

  // --------------------------
  // Boot
  // --------------------------
  (async function boot() {
    // CSS vars iniciales
    document.documentElement.style.setProperty('--overlay-alpha', OVERLAY_ALPHA.toString());
    document.documentElement.style.setProperty('--piece-radius', `${RADIUS_PX}px`);

    // Audio
    makeClickPool();
    setupBGM();

    // Autodetección (ext/rows/cols)
    try {
      const auto = await autodetectGridAndExt();
      state.rows = auto.rows || state.rows;
      state.cols = auto.cols || state.cols;
      state.ext  = auto.ext  || state.ext;
    } catch (e) {
      console.warn('[game-runtime] autodetectGridAndExt falló, uso defaults.', e);
    }

    // Dims celda por A1 real si existe
    try {
      const dim = await loadImageDims(`${ASSET_DIR}/A1${state.ext}`);
      if (dim?.width && dim?.height) {
        state.baseCellW = dim.width; state.baseCellH = dim.height;
      }
    } catch { /* usa CSS vars/fallback */ }

    // Refresca CSS
    $board.style.setProperty('--rows', String(state.rows));
    $board.style.setProperty('--cols', String(state.cols));
    $board.style.setProperty('--cellW', `${state.baseCellW}px`);
    $board.style.setProperty('--cellH', `${state.baseCellH}px`);

    fitBoard();
    buildGuideGrid();

    // Lista de imágenes y piezas detrás del overlay
    state.images = generateAssetList(state.rows, state.cols, state.ext);
    spawnPieces();
    randomScatter();
    updateTimerLabel(TIME_LIMIT);
    updatePiecesCountUI();
    updateCompletionUI();

    // Prompt de inicio
    const overlay = ensureStartOverlay();
    overlay.classList.add('open');
    const btn = overlay.querySelector('#btn-start-game');
    btn?.addEventListener('click', () => {
      closeStartOverlay();
      startGameFromPrompt();
    });

    // Listeners
    $btnRestart?.addEventListener('click', reset);
    $btnEndAct?.addEventListener('click', async () => {
      if ($btnEndAct.disabled) return;
      const prevText = $btnEndAct.textContent;
      try {
        $btnEndAct.disabled = true;
        $btnEndAct.textContent = 'Guardando...';
        $btnEndAct.setAttribute('aria-busy', 'true');
        $btnEndAct.style.opacity = '0.7';
      } catch {}

      try {
        const payload = { gameId: GAME_ID, gameTitle: GAME_TITLE, score: Number(state.lastScore || 0) };
        await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      } catch {}
      try { window.location.href = '/admin/scores'; } catch {
        // Si no logra navegar, reestablece el botón para reintentar
        try {
          $btnEndAct.disabled = false;
          $btnEndAct.textContent = prevText || 'Continuar';
          $btnEndAct.removeAttribute('aria-busy');
          $btnEndAct.style.opacity = '';
        } catch {}
      }
    });

    // Resize
    const onResize = () => { fitBoard(); resolveObstructions(false); };
    window.addEventListener('resize', onResize);

    // Cleanup
    state._cleanup = () => {
      window.removeEventListener('resize', onResize);
      stopTimer(); hideEndBanner(); destroyPieces();
      const o = document.getElementById('start-overlay'); if (o) o.remove();
    };
  })().catch(err => {
    console.error('[game-runtime] boot error:', err);
  });

  // --------------------------
  // Reset
  // --------------------------
  function reset() {
    stopTimer(); hideEndBanner(); destroyPieces();
    fitBoard(); buildGuideGrid();
    spawnPieces(); randomScatter();
    state.timeLeft = TIME_LIMIT;
    updateTimerLabel(state.timeLeft);
    updatePiecesCountUI(); updateCompletionUI();
    // No arrancamos aquí: se espera usar el prompt o que el botón reset se use en juego iniciado
    startTimer(TIME_LIMIT);
  }

  // return cleanup for React
  return () => {
    try { state._cleanup?.(); } catch {}
  };
}
