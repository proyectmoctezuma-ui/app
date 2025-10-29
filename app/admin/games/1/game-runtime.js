export function initGame() {
  if (typeof window === 'undefined') return () => {};

  // Identidad del juego para el sistema de puntajes
  const GAME_ID = 1;
  const GAME_TITLE = 'Construyendo el propósito';

  const ASSET_DIR = '/games/1/assets';
  const AUDIO_DIR = '/games/1/audio';
  const CANDIDATE_EXTS = ['.jpg', '.png', '.jpeg'];
  const MAX_PROBE_ROWS = 26;
  const MAX_PROBE_COLS = 60;

  const TIME_LIMIT = 240;
  const SNAP_TOL_FACTOR = 0.35;
  const RADIUS_PX = 14;
  const OVERLAY_ALPHA = 0.12;
  const DESKTOP_BLOCK_RIGHT_BAND = false;
  const MOBILE_BLOCK_TOP_BAND = false;
  const OBSTRUCT_MARGIN = 10;
  const TILT_DEG = 10;
  // Si true, en desktop intentamos ubicar piezas en las franjas izquierda/derecha
  // alrededor del tablero (dentro de board-wrap) en lugar de dispersarlas uniformemente.
  // Por defecto false para conservar el comportamiento actual.
  const DESKTOP_SIDE_SCATTER = true;

  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
  const parseDeg = (str) => (str ? (parseFloat(String(str).replace('deg', '')) || 0) : 0);
  const randRange = (a, b) => a + Math.random() * (b - a);
  const randTilt = () => `${((Math.random() * 2 - 1) * TILT_DEG).toFixed(2)}deg`;
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const rectsOverlap = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const idByRowCol = (r, c, rows, cols) => (r < 0 || c < 0 || r >= rows || c >= cols) ? null : `${String.fromCharCode(65 + r)}${c + 1}`;

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
  const $btnRestart = document.getElementById('btn-reset');

  if (!$boardWrap || !$boardFrame || !$board) return () => {};

  $boardFrame.style.width = '100%';
  $boardFrame.style.height = '100%';

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
    _ended: false,

    timeLeft: TIME_LIMIT,
    timerId: null,

    // Puntaje final calculado al terminar
    lastScore: 0,

    _rafDragging: false,
    _rafPieceId: null,
    _rafLastClientX: 0,
    _rafLastClientY: 0,

    clickPool: [],
    bgm: null,

    _cleanup: null,

    // Bloqueo de navegaciÃ³n durante la partida
    _navLocked: false,
    _navClickHandler: null,
    _navLockedEls: []
  };

  // --- Audio mÃ­nimo ---
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
    try { a.currentTime = 0; a.volume = (window.VolumeSystem?.get?.() ?? 0.5); a.play().catch(() => {}); } catch {}
  }
  function setupBGM() {
    state.bgm = new Audio(`${AUDIO_DIR}/background_music.mp3`);
    state.bgm.loop = true;
    state.bgm.preload = 'auto';
    state.bgm.volume = (window.VolumeSystem?.get?.() ?? 0.5);
    window.VolumeSystem?.onChange?.((v) => { if (state.bgm) state.bgm.volume = v; });
  }
  function setMusic(on) { if (!state.bgm) return; on ? state.bgm.play().catch(() => {}) : state.bgm.pause(); }

  // --- Assets ---
  function imgExists(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; }); }
  async function chooseWorkingExt() { for (const ext of CANDIDATE_EXTS) { if (await imgExists(`${ASSET_DIR}/A1${ext}`)) return ext; } return null; }
  async function autodetectGridAndExt() {
    const ext = await chooseWorkingExt();
    if (!ext) return { rows: 4, cols: 6, ext: '.jpg' };
    let rows = 0; for (let r = 0; r < MAX_PROBE_ROWS; r++) { const ok = await imgExists(`${ASSET_DIR}/${String.fromCharCode(65 + r)}1${ext}`); if (!ok) break; rows++; }
    if (rows === 0) rows = 4;
    let cols = 0; for (let c = 1; c <= MAX_PROBE_COLS; c++) { const ok = await imgExists(`${ASSET_DIR}/A${c}${ext}`); if (!ok) break; cols++; }
    if (cols === 0) cols = 6;
    return { rows, cols, ext };
  }
  function generateAssetList(rows, cols, ext) {
    const list = [];
    for (let r = 0; r < rows; r++) {
      const letter = String.fromCharCode(65 + r);
      for (let c = 0; c < cols; c++) list.push({ id: `${letter}${c + 1}`, row: r, col: c, src: `${ASSET_DIR}/${letter}${c + 1}${ext}` });
    }
    return list;
  }
  function loadImageDims(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => rej(new Error('loadImageDims')); i.src = src; }); }

  // --- MediciÃ³n mÃ³vil (evitar scroll por HUD) ---
  function measureAndSetHeights() {
        const viewportVar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viewport-height')) || 0;
    const baseVH = window.visualViewport?.height || window.innerHeight || 0;
    const vh = Math.max(200, Math.min(...[baseVH, viewportVar || baseVH].filter(Boolean)));
    const hudH = (!isDesktop() && $hud) ? $hud.offsetHeight : 0; // solo mÃ³vil
    const bottomSlack = 14;
    const stageEl = document.querySelector('.stage');
    const csStage = stageEl ? getComputedStyle(stageEl) : null;
    const padTop = csStage ? parseFloat(csStage.paddingTop) || 0 : 0;
    const padBottom = csStage ? parseFloat(csStage.paddingBottom) || 0 : 0;
    const wrapH = Math.max(220, vh - hudH - bottomSlack - padTop - padBottom);
    document.documentElement.style.setProperty('--wrapH', wrapH + 'px');
    document.documentElement.style.setProperty('--appH', vh + 'px');
    document.documentElement.style.setProperty('--hud-height', ($hud?.offsetHeight || 0) + 'px');
    $boardWrap.style.height = wrapH + 'px';
  }

  // --- Layout/fit (tu centrado intacto) ---
  function fitBoard() {
    state.baseBoardW = state.baseCellW * state.cols;
    state.baseBoardH = state.baseCellH * state.rows;

    const frameRect = $boardFrame.getBoundingClientRect();
    const availW = Math.max(50, frameRect.width);
    const availH = Math.max(50, frameRect.height);

    const sx = availW / state.baseBoardW;
    const sy = availH / state.baseBoardH;
    const scale = Math.max(0.0001, Math.min(sx, sy)) * 0.995;
    state.scale = scale;

    const scaledW = state.baseBoardW * scale;
    const scaledH = state.baseBoardH * scale;

    const offsetX = Math.max(0, (availW - scaledW) / 2);
    const vBias   = isDesktop() ? 0.5 : 0.25;
    const offsetY = Math.max(0, (availH - scaledH)) * vBias;

    $board.style.width  = `${state.baseBoardW}px`;
    $board.style.height = `${state.baseBoardH}px`;
    $board.style.transformOrigin = 'top left';
    $board.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

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
    svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'grid-lines'); g.setAttribute('vector-effect', 'non-scaling-stroke');

    for (let c = 1; c < state.cols; c++) {
      const x = c * state.baseCellW;
      const line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', x); line.setAttribute('y1', 0); line.setAttribute('x2', x); line.setAttribute('y2', state.baseBoardH);
      g.appendChild(line);
    }
    for (let r = 1; r < state.rows; r++) {
      const y = r * state.baseCellH;
      const line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', 0); line.setAttribute('y1', y); line.setAttribute('x2', state.baseBoardW); line.setAttribute('y2', y);
      g.appendChild(line);
    }
    svg.appendChild(g);
    $guideGrid.appendChild(svg);
    $board.classList.remove('show-grid', 'grid-strong', 'focus-drag');
  }

  // *** NUEVO: espacios libres ALREDEDOR DEL BOARD (transformado) ***
  function getFreeSpacesAroundBoard() {
    const wrapRect = $boardWrap.getBoundingClientRect();
    const boardRect = $board.getBoundingClientRect(); // ya incluye translate+scale
    const left = Math.max(0, boardRect.left - wrapRect.left) / state.scale;
    const right = Math.max(0, wrapRect.right - boardRect.right) / state.scale;
    const top = Math.max(0, boardRect.top - wrapRect.top) / state.scale;
    const bottom = Math.max(0, wrapRect.bottom - boardRect.bottom) / state.scale;
    return { left, right, top, bottom, wrapRect, boardRect };
  }

  function getDragClampRect() {
    const spaces = getFreeSpacesAroundBoard();
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
    const isShown = (el) => { if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };

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
        prect = { ...prect,
          left: prect.left + (best.axis === 'x' ? best.val : 0),
          right: prect.right + (best.axis === 'x' ? best.val : 0),
          top: prect.top + (best.axis === 'y' ? best.val : 0),
          bottom: prect.bottom + (best.axis === 'y' ? best.val : 0),
        };
      }

      if (prect.left < wrapRect.left)   dx += (wrapRect.left - prect.left + OBSTRUCT_MARGIN);
      if (prect.right > wrapRect.right) dx -= (prect.right - wrapRect.right + OBSTRUCT_MARGIN);
      if (prect.top < wrapRect.top)     dy += (wrapRect.top - prect.top + OBSTRUCT_MARGIN);
      if (prect.bottom > wrapRect.bottom) dy -= (prect.bottom - wrapRect.bottom + OBSTRUCT_MARGIN);

      if (dx !== 0 || dy !== 0) {
        p.x = (p.x ?? 0) + dx / state.scale;
        p.y = (p.y ?? 0) + dy / state.scale;
        ensureWithinBounds(p);
        if (animate) p.el.style.transition = 'transform 260ms ease, opacity 160ms ease';
        applyTransformTo(p.el, p.x, p.y, p.rotation ?? 0);
      }
    }
  }

  // --- Piezas ---
  function applyTransformTo(el, x, y, rotDeg = 0) { el.style.setProperty('--tx', `${x}px`); el.style.setProperty('--ty', `${y}px`); el.style.setProperty('--rot', `${rotDeg}deg`); }
  function setOverlay(el, alpha) { el.style.setProperty('--overlay-alpha', alpha.toString()); }
  function destroyPieces() { $board.querySelectorAll('.piece').forEach(n => n.remove()); state.pieces.clear(); state.lockedCount = 0; updateCompletionUI(); updatePiecesCountUI(); }
  function spawnPieces() {
    destroyPieces();
    const frag = document.createDocumentFragment();
    for (const meta of state.images) {
      const el = document.createElement('div');
      el.className = 'piece'; el.dataset.id = meta.id;
      el.style.setProperty('--rot', randTilt()); el.style.setProperty('--scale-extra', '1'); el.style.borderRadius = `${RADIUS_PX}px`;
      const img = document.createElement('img'); img.alt = meta.id; img.src = meta.src; el.appendChild(img);
      const p = { id: meta.id, row: meta.row, col: meta.col, x: 0, y: 0, rotation: parseDeg(el.style.getPropertyValue('--rot')) || 0, el, locked: false };
      state.pieces.set(meta.id, p);
      el.addEventListener('pointerdown', onPointerDown);
      frag.appendChild(el);
    }
    $board.appendChild(frag);
  }

  // *** NUEVO: scatter uniforme en TODO el board-wrap ***
  function randomScatter() {
    const spaces = getFreeSpacesAroundBoard();
    const clampMinY = -spaces.top;
    const clampMaxY = state.baseBoardH - state.baseCellH + spaces.bottom;

    // Modo especial: solo en desktop, colocar en franjas laterales
    if (isDesktop() && DESKTOP_SIDE_SCATTER) {
      const pieces = Array.from(state.pieces.values());

      // Rangos "enteramente fuera del tablero" si hay espacio suficiente
      const canLeftOut = spaces.left >= state.baseCellW;
      const canRightOut = spaces.right >= state.baseCellW;

      const leftMinX = -spaces.left;
      const leftMaxX = canLeftOut ? -state.baseCellW : Math.min(-1, 0 - spaces.left); // si no cabe, pegar al borde

      const rightMinX = canRightOut ? state.baseBoardW : Math.max(state.baseBoardW - 1, state.baseBoardW - state.baseCellW);
      const rightMaxX = state.baseBoardW - state.baseCellW + spaces.right;

      const hasLeftStripe = spaces.left > 4;
      const hasRightStripe = spaces.right > 4;

      // Si no hay franjas viables, usamos el dispersado original
      if (!hasLeftStripe && !hasRightStripe) {
        const minX = -spaces.left;
        const maxX = state.baseBoardW - state.baseCellW + spaces.right;
        for (const p of pieces) {
          p.x = randRange(minX, Math.max(minX, maxX));
          p.y = randRange(clampMinY, Math.max(clampMinY, clampMaxY));
          p.rotation = parseDeg(randTilt());
          applyTransformTo(p.el, p.x, p.y, p.rotation);
          setOverlay(p.el, OVERLAY_ALPHA);
          applyCornerRadius(p);
        }
        return;
      }

      // Distribuir ponderando por el ancho libre (si ambos lados existen)
      const totalWidth = (hasLeftStripe ? spaces.left : 0) + (hasRightStripe ? spaces.right : 0);
      for (const p of pieces) {
        let useLeft = hasLeftStripe && !hasRightStripe ? true
                    : !hasLeftStripe && hasRightStripe ? false
                    : Math.random() < (spaces.left / Math.max(1, totalWidth));

        if (useLeft) {
          const x0 = leftMinX;
          const x1 = leftMaxX;
          const minX = Math.min(x0, x1);
          const maxX = Math.max(x0, x1);
          p.x = randRange(minX, Math.max(minX, maxX));
        } else {
          const x0 = rightMinX;
          const x1 = rightMaxX;
          const minX = Math.min(x0, x1);
          const maxX = Math.max(x0, x1);
          p.x = randRange(minX, Math.max(minX, maxX));
        }

        p.y = randRange(clampMinY, Math.max(clampMinY, clampMaxY));
        p.rotation = parseDeg(randTilt());
        applyTransformTo(p.el, p.x, p.y, p.rotation);
        setOverlay(p.el, OVERLAY_ALPHA);
        applyCornerRadius(p);
      }
      return;
    }

    // Comportamiento original (uniforme en todo el board-wrap)
    const minX = -spaces.left;
    const maxX = state.baseBoardW - state.baseCellW + spaces.right;
    for (const p of state.pieces.values()) {
      p.x = randRange(minX, Math.max(minX, maxX));
      p.y = randRange(clampMinY, Math.max(clampMinY, clampMaxY));
      p.rotation = parseDeg(randTilt());
      applyTransformTo(p.el, p.x, p.y, p.rotation);
      setOverlay(p.el, OVERLAY_ALPHA);
      applyCornerRadius(p);
    }
  }

  // Drag & snap
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
  function onPointerMove(e) { if (!dragCtx) return; state._rafLastClientX = e.clientX; state._rafLastClientY = e.clientY; }
  function onPointerUp(e) { finishDrag(e); }
  function onPointerCancel(e) { finishDrag(e); }

  function _dragRAF() {
    if (!state._rafDragging || !dragCtx) return;
    const piece = state.pieces.get(dragCtx.id);
    if (piece) {
      const dxBoard = (state._rafLastClientX - dragCtx.startX) / state.scale;
      const dyBoard = (state._rafLastClientY - dragCtx.startY) / state.scale;
      const { minX, maxX, minY, maxY } = getDragClampRect();
      piece.x = clamp(dragCtx.baseX + dxBoard, minX, maxX);
      piece.y = clamp(dragCtx.baseY + dyBoard, minY, maxY);
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
      piece.x = targetX; piece.y = targetY; piece.rotation = 0;
      piece.el.classList.add('locked');
      applyTransformTo(piece.el, piece.x, piece.y, 0);
      piece.el.classList.add('snap-pulse');

      setOverlay(piece.el, 0);
      state.lockedCount++;
      updateCompletionUI(); updatePiecesCountUI();

      applyCornerRadius(piece); forEachNeighbor(piece, (np) => applyCornerRadius(np));

      setTimeout(() => piece.el.classList.remove('snap-pulse'), 380);
      playClick();

      if (state.lockedCount >= state.images.length) {
        try { stopTimer(); } catch {}
        endGame(true);
      }
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

  // --- Timer & banner ---
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

  // Puntaje proporcional a progreso: 0..40
  function calcScore(lockedCountSnapshot = state.lockedCount) {
    const total = state.images.length || 0;
    if (total <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, lockedCountSnapshot / total));
    return Math.round(40 * ratio);
  }
  function startTimer(totalSeconds) {
    // No arranques si ya terminÃ³
    if (state._ended) { state.started = false; return; }
    state.timeLeft = totalSeconds;
    updateTimerLabel(state.timeLeft);
    state.started = true;
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      // Corta el intervalo si el juego ya terminÃ³ por cualquier razÃ³n
      if (state._ended) { try { clearInterval(state.timerId); } catch {} state.timerId = null; return; }
      state.timeLeft--;
      updateTimerLabel(state.timeLeft);
      if (state.timeLeft <= 0) { stopTimer(); endGame(false); }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) { try { clearInterval(state.timerId); } catch {} state.timerId = null; }
  }
  async function autoCompleteRemaining(opts = {}) {
    const preserveCounts = !!opts.preserveCounts;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const notLocked = Array.from(state.pieces.values()).filter(p => !p.locked);
    for (const p of notLocked) {
      p.x = p.col * state.baseCellW; p.y = p.row * state.baseCellH; p.rotation = 0; p.locked = true;
      p.el.classList.add('locked'); setOverlay(p.el, 0); applyTransformTo(p.el, p.x, p.y, 0); p.el.style.filter = 'grayscale(1)';
      applyCornerRadius(p); forEachNeighbor(p, (np) => applyCornerRadius(np));
      await delay(18);
    }
    if (!preserveCounts) {
      state.lockedCount = state.images.length; updateCompletionUI(); updatePiecesCountUI();
    }
  }
  function showEndBanner(won, score) {
    const cfg = won ? { title: '¡Completado!', body: '¡Felicidades! Has logrado construir Nuestro Propósito', button: 'Continuar' }
                    : { title: '¡Tiempo!', body: 'Te invitamos a que sigas contribuyendo al logro de Nuestro Propósito', button: 'Continuar' };
    const $title = document.getElementById('end-title');
    const $endExtra = document.getElementById('end-extra');
    if ($title) $title.textContent = cfg.title;
    if ($endExtra) $endExtra.textContent = cfg.body;
    if ($finalScore) $finalScore.textContent = String(score);
    if ($btnEndAct) { $btnEndAct.hidden = false; $btnEndAct.textContent = cfg.button; }
    if ($banner) { $banner.hidden = false; void $banner.offsetWidth; $banner.classList.add('visible'); }
  }
  function hideEndBanner() { if (!$banner) return; $banner.classList.remove('visible'); setTimeout(() => { $banner.hidden = true; }, 320); }
  
  // --- Bloqueo de navegaciÃ³n (navbar/links) mientras el juego estÃ¡ en curso ---
  function lockNav() {
    if (state._navLocked) return;
    state._navLocked = true;
    try {
      const selectors = [
        'nav a', 'header a', '.navbar a', '.nav a',
        'a[data-nav]',
        'a[href="/"]', 'a[href="/admin"]', 'a[href^="/admin/"]',
        'a[href="/admin/games"]', 'a[href="/admin/scores"]', 'a[href="/admin/dashboard"]'
      ].join(',');

      const anchors = Array.from(document.querySelectorAll(selectors));
      state._navLockedEls = anchors.map(a => {
        const prev = {
          el: a,
          pe: a.style.pointerEvents || '',
          tab: a.getAttribute('tabindex'),
          aria: a.getAttribute('aria-disabled')
        };
        try { a.style.pointerEvents = 'none'; } catch {}
        try { a.setAttribute('tabindex', '-1'); } catch {}
        try { a.setAttribute('aria-disabled', 'true'); } catch {}
        return prev;
      });

      const onClick = (e) => {
        const target = e.target;
        const a = target && typeof target.closest === 'function' ? target.closest('a') : null;
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (a.closest('nav') || a.closest('header') || a.closest('.navbar') || a.closest('.nav') || href === '/' || href.startsWith('/admin')) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      state._navClickHandler = onClick;
      document.addEventListener('click', onClick, true);
    } catch {}
  }

  function unlockNav() {
    if (!state._navLocked) return;
    state._navLocked = false;
    try { if (state._navClickHandler) { document.removeEventListener('click', state._navClickHandler, true); } } catch {}
    try {
      (state._navLockedEls || []).forEach(prev => {
        try { prev.el.style.pointerEvents = prev.pe; } catch {}
        if (prev.tab == null) { try { prev.el.removeAttribute('tabindex'); } catch {} } else { try { prev.el.setAttribute('tabindex', prev.tab); } catch {} }
        if (prev.aria == null) { try { prev.el.removeAttribute('aria-disabled'); } catch {} } else { try { prev.el.setAttribute('aria-disabled', prev.aria); } catch {} }
      });
    } catch {}
    state._navLockedEls = [];
    state._navClickHandler = null;
  }
  async function endGame(won) {
    if (state._ended) return;
    state._ended = true;
    stopTimer();
    state.started = false;
    try { unlockNav(); } catch {}
    const lockedAtEnd = state.lockedCount;
    const score = calcScore(lockedAtEnd);
    try { state.lastScore = score; } catch {}
    if (!won) await autoCompleteRemaining({ preserveCounts: true });

    // Agrupar finales entre posibles instancias (StrictMode/dev) y emitir 1 sola vez con el mejor score
    try {
      const win = window;
      win.__GAME_END_QUEUE = win.__GAME_END_QUEUE || [];
      win.__GAME_END_EMITTED = !!win.__GAME_END_EMITTED;
      win.__GAME_END_SCHEDULED = !!win.__GAME_END_SCHEDULED;

      win.__GAME_END_QUEUE.push({ score, won, run: () => showEndBanner(won, score) });
      if (!win.__GAME_END_SCHEDULED) {
        win.__GAME_END_SCHEDULED = true;
        setTimeout(() => {
          const q = win.__GAME_END_QUEUE || [];
          let best = null;
          for (const it of q) { if (!best || it.score > best.score) best = it; }
          if (best && !win.__GAME_END_EMITTED) {
            win.__GAME_END_EMITTED = true;
            try {
              win.dispatchEvent(new CustomEvent('game:end', { detail: { won: best.won, score: best.score } }));
              win.onGameFinish?.({ won: best.won, score: best.score });
              if (!win.onGameFinish) console.log('[onGameFinish]', { won: best.won, score: best.score });
            } catch {}
            try { best.run?.(); } catch {}
          }
          win.__GAME_END_QUEUE = [];
          win.__GAME_END_SCHEDULED = false;
        }, 0);
      }
    } catch {
      // fallback directo
      try {
        window.dispatchEvent(new CustomEvent('game:end', { detail: { won, score } }));
        window.onGameFinish?.({ won, score });
        if (!window.onGameFinish) console.log('[onGameFinish]', { won, score });
      } catch {}
      showEndBanner(won, score);
    }
  }

  // --- Start overlay ---
  function ensureStartOverlay() {
    let overlay = document.getElementById('start-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.className = 'open';
    overlay.innerHTML = `
      <div class="start-backdrop"></div>
      <div class="start-content">
        <h2>Construyendo el Propósito</h2>
        <p>Arma el rompecabezas arrastrando las piezas a su lugar en el menor tiempo posible.</p>
        <div class="start-actions"><button id="btn-start-game" class="btn primary">Iniciar Juego</button></div>
      </div>`;
    ($app || document.body).appendChild(overlay);
    return overlay;
  }
  function closeStartOverlay() { const overlay = document.getElementById('start-overlay'); if (!overlay) return; overlay.classList.remove('open'); overlay.style.display = 'none'; }
  function startGameFromPrompt() {
    try { setMusic(true); } catch {}
    try { lockNav(); } catch {}
    state._ended = false;
    try {
      window.__GAME_END_EMITTED = false;
      window.__GAME_END_QUEUE = [];
      window.__GAME_END_SCHEDULED = false;
    } catch {}
    state.started = true;
    startTimer(TIME_LIMIT);
  }

  // --- Referencia (mostrar en mÃ³vil; el botÃ³n se crea siempre) ---
  function ensureHudReferenceButton() {
    if (!$hudRight) return;
    if (document.getElementById('btn-reference')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-reference';
    btn.className = 'btn ghost';
    btn.type = 'button';
    btn.textContent = 'Referencia';
    btn.addEventListener('click', openRefOverlay);
    $hudRight.appendChild(btn);
  }
  function ensureRefOverlay() {
    let $ov = document.getElementById('ref-overlay');
    if ($ov) return $ov;
    $ov = document.createElement('div');
    $ov.id = 'ref-overlay';
    $ov.innerHTML = `
      <div class="ref-backdrop"></div>
      <div class="ref-content" role="dialog" aria-modal="true" aria-labelledby="ref-title">
        <div class="ref-head">
          <h3 id="ref-title">Referencia</h3>
          <button class="btn ghost ref-close" id="ref-close" aria-label="Cerrar">X</button>
        </div>
        <div class="ref-body">
          <img id="ref-image-overlay" src="${ASSET_DIR}/_reference.jpg" alt="Imagen de referencia" />
        </div>
      </div>`;
    ($app || document.body).appendChild($ov);
    const close = () => { $ov.classList.remove('open'); setTimeout(() => { $ov.style.display = 'none'; }, 220); };
    $ov.querySelector('#ref-close').addEventListener('click', close);
    $ov.querySelector('.ref-backdrop').addEventListener('click', close);
    return $ov;
  }
  function openRefOverlay() { const $ov = ensureRefOverlay(); $ov.style.display = 'block'; requestAnimationFrame(() => $ov.classList.add('open')); }

  // --- Boot ---
  (async function boot() {
    document.documentElement.style.setProperty('--overlay-alpha', OVERLAY_ALPHA.toString());
    document.documentElement.style.setProperty('--piece-radius', `${RADIUS_PX}px`);
    makeClickPool(); setupBGM();

    measureAndSetHeights();

    try { const auto = await autodetectGridAndExt(); state.rows = auto.rows || state.rows; state.cols = auto.cols || state.cols; state.ext = auto.ext || state.ext; } catch {}
    try { const dim = await loadImageDims(`${ASSET_DIR}/A1${state.ext}`); if (dim?.width && dim?.height) { state.baseCellW = dim.width; state.baseCellH = dim.height; } } catch {}

    $board.style.setProperty('--rows', String(state.rows));
    $board.style.setProperty('--cols', String(state.cols));
    $board.style.setProperty('--cellW', `${state.baseCellW}px`);
    $board.style.setProperty('--cellH', `${state.baseCellH}px`);

    fitBoard();
    buildGuideGrid();

    state.images = generateAssetList(state.rows, state.cols, state.ext);
    spawnPieces();
    randomScatter();
    resolveObstructions(false);

    updateTimerLabel(TIME_LIMIT);
    updatePiecesCountUI();
    updateCompletionUI();

    const overlay = ensureStartOverlay();
    overlay.classList.add('open');
    overlay.querySelector('#btn-start-game')?.addEventListener('click', () => { closeStartOverlay(); startGameFromPrompt(); });

    ensureHudReferenceButton(); // se oculta por CSS en desktop

    // Si por cualquier motivo se emite el evento global de fin, corta el timer
    const onGameEndStop = () => { try { stopTimer(); } catch {} state._ended = true; };
    window.addEventListener('game:end', onGameEndStop);

    $btnRestart?.addEventListener('click', reset);
    // Evita mÃºltiples bindings en modo Strict/dev
    if ($btnEndAct && !$btnEndAct.dataset.bound) {
      $btnEndAct.dataset.bound = '1';
      $btnEndAct.addEventListener('click', async () => {
        if (!$btnEndAct) return;
        if ($btnEndAct.disabled) return;
        const prevText = $btnEndAct.textContent;
        try {
          $btnEndAct.disabled = true;
          $btnEndAct.textContent = 'Guardando...';
          $btnEndAct.setAttribute('aria-busy', 'true');
          $btnEndAct.style.opacity = '0.7';
        } catch {}

        try {
        const txt = ($finalScore?.textContent || '').trim();
        let computed = Number.parseInt(txt, 10);
        if (!Number.isFinite(computed)) {
          computed = Number(state.lastScore || 0) || 0;
        }
        const payload = { gameId: GAME_ID, gameTitle: GAME_TITLE, score: computed };
        await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      } catch {}

      try {
        // Al guardar, redirige al panel de scores (el layout impide rejugar)
        window.location.href = '/admin/scores';
      } catch {
        // Si fallara la navegaciÃ³n, restaura el botÃ³n para reintentar
        try {
          $btnEndAct.disabled = false;
          $btnEndAct.textContent = prevText || 'Continuar';
          $btnEndAct.removeAttribute('aria-busy');
          $btnEndAct.style.opacity = '';
        } catch {}
      }
      });
    }

    const onResize = () => { measureAndSetHeights(); fitBoard(); resolveObstructions(true); };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    state._cleanup = () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      try { window.removeEventListener('game:end', onGameEndStop); } catch {}
      stopTimer(); hideEndBanner(); destroyPieces();
      try { unlockNav(); } catch {}
      const o = document.getElementById('start-overlay'); if (o) o.remove();
    };
  })().catch(console.error);

  function reset() {
    stopTimer(); hideEndBanner(); destroyPieces();
    measureAndSetHeights(); fitBoard(); buildGuideGrid();
    spawnPieces(); randomScatter(); resolveObstructions(false);
    state._ended = false; state.started = false; try {
      window.__GAME_END_EMITTED = false;
      window.__GAME_END_QUEUE = [];
      window.__GAME_END_SCHEDULED = false;
    } catch {}
    state.timeLeft = TIME_LIMIT; updateTimerLabel(state.timeLeft); updatePiecesCountUI(); updateCompletionUI();
    startTimer(TIME_LIMIT);
  }

  return () => { try { state._cleanup?.(); } catch {} };
}





