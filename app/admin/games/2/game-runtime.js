// Runtime del juego 2 (tren) adaptado para Next.js
import { Deco } from './decorations';

export function initTrenGame() {
  if (typeof window === 'undefined') return () => {};

  const CONFIG = {
    MAX_SCORE_PERFECT: 40,
    PENALTY_PER_ERROR: 5,
    MAX_ERRORS: 2,

    TRAIN_SPEED: 50,
    PREMOVE_DELAY_MS: 2200,
    FADE_DURATION_MS: 500,
    TILE_BASE_SIZE: 96,
    RANDOM_DEFAULT_BIAS: 0.5,

    ANIM_WOBBLE_AMPL: 0.03,
    ANIM_WOBBLE_SPEED: 2.0,
    ANIM_WOBBLE_PHASE_WAGON: 0.6,

    SHADOW_OPACITY: 0.40,
    SHADOW_BLUR_FACTOR: 0.04,
    SHADOW_OFFSET_X_FACTOR: -0.08,
    SHADOW_OFFSET_Y_FACTOR: 0.12,

    BG_LERP_TIME: 2.5,

    QUESTIONS_FILE: '/games/2/jsons/preguntas.json',
    FEEDBACK_FILE: '/games/2/jsons/mensajes.json',

    SCENARIOS_POOL: ['/games/2/jsons/escenario_01.json'],
    FINAL_SCENARIO: '/games/2/jsons/escenario_final.json',

    QUESTIONS_PER_RUN: 8,
    SHUFFLE_AB_PROB: 0.5,

    SHOW_RESTART_BUTTON: false,

    MESSAGES: {
      winTitle: 'Tu tren llegó al destino',
      winBody: 'impulsado por decisiones correctas. ¡Gracias por ser un ejemplo de integridad!',
      loseTitle: 'El tren se desvió',
      loseBody: 'Pero aún puedes retomar la vía correcta. Tus valores son la mejor guía'
    },

    DESKTOP_BP: 900,

    DEBUG: false,
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  function lerpAngle(a, b, t) { let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; return a + diff * t; }
  function lettersToIndex(letters) { let res = 0; for (let i = 0; i < letters.length; i++) res = res * 26 + (letters.charCodeAt(i) - 64); return res - 1; }
  function parseCell(cell) { const m = /^([A-Z]+)(\d+)$/.exec(cell.trim().toUpperCase()); if (!m) throw new Error('Celda inválida: ' + cell); return { col: lettersToIndex(m[1]), row: parseInt(m[2], 10) - 1 }; }
  function cellCenterPx(cell, ts) { const { col, row } = parseCell(cell); return { x: col * ts + ts / 2, y: row * ts + ts / 2 }; }
  function cellTopLeftPx(cell, ts) { const { col, row } = parseCell(cell); return { x: col * ts, y: row * ts }; }
  function buildRoutePoints(seq, ts) { return seq.map(c => cellCenterPx(c, ts)); }
  function computeCumulative(route) {
    const pts = [];
    let acc = 0;
    for (let i = 0; i < route.length; i++) {
      const p = route[i];
      if (i > 0) {
        const q = route[i - 1];
        acc += Math.hypot(p.x - q.x, p.y - q.y);
      }
      pts.push({ x: p.x, y: p.y, s: acc });
    }
    return pts;
  }
  function setCurrentRoute(points, preserveMode = 'none') {
    const prevTotal = cumRoute?.length ? (cumRoute[cumRoute.length - 1]?.s || 0) : 0;
    const prevDist = sHead;

    cumRoute = computeCumulative(points);
    const newTotal = cumRoute.length ? (cumRoute[cumRoute.length - 1]?.s || 0) : 0;

    if (preserveMode === 'ratio' && prevTotal > 0 && newTotal > 0) {
      const progress = clamp(prevDist / prevTotal, 0, 1);
      sHead = clamp(progress * newTotal, 0, newTotal);
    } else if (preserveMode === 'absolute' && newTotal > 0) {
      sHead = clamp(prevDist, 0, newTotal);
    } else if (preserveMode === 'none') {
      sHead = 0;
    }

    return newTotal;
  }
  function posOnRoute(cum, s) {
    if (!cum || cum.length === 0) return { x: 0, y: 0, angle: 0 };
    if (s <= cum[0].s) return { x: cum[0].x, y: cum[0].y, angle: null };
    if (s >= cum[cum.length-1].s) return { x: cum[cum.length-1].x, y: cum[cum.length-1].y, angle: null };
    let i = 1; while (i < cum.length && cum[i].s < s) i++;
    const a = cum[i-1], b = cum[i];
    const t = (s - a.s) / (b.s - a.s);
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
    const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI/2;
    return { x, y, angle };
  }
  const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

  async function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      try {
        img.decoding = 'async';
      } catch (_) {}
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  const tileCache = {};
  const deferredTiles = new Set();
  const runDeferred = (fn) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => fn(), { timeout: 500 });
    } else {
      setTimeout(() => fn(), 60);
    }
  };
  async function getTileImage(name) { if (tileCache[name]) return tileCache[name]; const src = `/games/2/assets/tiles/${name}.png`; tileCache[name] = await loadImage(src); return tileCache[name]; }
  function resolveTileName(baseName, selected) {
    let name = baseName;
    // Bifurcación: preferimos assets específicos left/right
    if (name === 'track_bi')    name = (selected === 'A') ? 'track_bi_left' : 'track_bi_right';
    // Switch genérico
    if (name === 'switch_base') name = (selected === 'A') ? 'switch_A' : 'switch_B';
    return name;
  }

  const canvas = document.getElementById('board');
  const ctx    = canvas.getContext('2d');
  const fadeEl = document.getElementById('fadeOverlay');
  const qCounter = document.getElementById('qCounter');
  const qTotal   = document.getElementById('qTotal');
  const progressFill = document.getElementById('progressFill');
  const scoreLabel   = document.getElementById('scoreLabel');
  const errorsLabel  = document.getElementById('errorsLabel');
  const elQuestion = document.getElementById('questionText');
  const btnA = document.getElementById('btnA');
  const btnB = document.getElementById('btnB');
  const finalEl = document.getElementById('gameFinal');
  const finalTitleNode = document.getElementById('finalTitle');
  const finalBodyNode  = document.getElementById('finalBody');
  const btnEndAction   = document.getElementById('btn-end-action');

  const navLockState = {
    locked: false,
    handler: null,
    anchors: []
  };

  function lockNav() {
    if (navLockState.locked) return;
    navLockState.locked = true;
    try {
      const selectors = [
        'nav a', 'header a', '.navbar a', '.nav a',
        'a[data-nav]',
        'a[href="/"]', 'a[href="/admin"]', 'a[href^="/admin/"]',
        'a[href="/admin/games"]', 'a[href="/admin/scores"]', 'a[href="/admin/dashboard"]'
      ].join(',');
      const anchors = Array.from(document.querySelectorAll(selectors));
      navLockState.anchors = anchors.map((a) => {
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
      navLockState.handler = (e) => {
        const target = e.target;
        const a = target && typeof target.closest === 'function' ? target.closest('a') : null;
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (a.closest('nav') || a.closest('header') || a.closest('.navbar') || a.closest('.nav') || href === '/' || href.startsWith('/admin')) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener('click', navLockState.handler, true);
    } catch {}
  }

  function unlockNav() {
    if (!navLockState.locked) return;
    navLockState.locked = false;
    try {
      if (navLockState.handler) {
        document.removeEventListener('click', navLockState.handler, true);
      }
    } catch {}
    try {
      (navLockState.anchors || []).forEach((prev) => {
        if (!prev?.el) return;
        try { prev.el.style.pointerEvents = prev.pe; } catch {}
        if (prev.tab == null) {
          try { prev.el.removeAttribute('tabindex'); } catch {}
        } else {
          try { prev.el.setAttribute('tabindex', prev.tab); } catch {}
        }
        if (prev.aria == null) {
          try { prev.el.removeAttribute('aria-disabled'); } catch {}
        } else {
          try { prev.el.setAttribute('aria-disabled', prev.aria); } catch {}
        }
      });
    } catch {}
    navLockState.anchors = [];
    navLockState.handler = null;
  }
  const headerEl = document.querySelector('.hud');
  const uiPanelEl = document.querySelector('.ui-panel');
  const stageEl   = document.querySelector('.stage');
  const wrapEl    = document.querySelector('.canvas-wrap');

  let decoBg, decoTop, decoBgCtx, decoTopCtx;
  let tilesBuffer = null;
  let tilesBufferCtx = null;
  let tilesDirty = true;
  let decoGeometry = null;
  let decoGeometryDirty = true;
  let resizeRaf = null;

  function ensureDecoCanvases() {
    if (!wrapEl) return;
    if (!decoBg) { decoBg = document.getElementById('decoBg'); decoBgCtx = decoBg?.getContext('2d'); }
    if (!decoTop) { decoTop = document.getElementById('decoTop'); decoTopCtx = decoTop?.getContext('2d'); }
  }
  function sizeOverlaysToWrap() {
    ensureDecoCanvases(); if (!wrapEl || !decoBg || !decoTop) return;
    const w = (wrapEl.clientWidth | 0); const h = (wrapEl.clientHeight | 0);
    if (w > 0 && h > 0) { if (decoBg.width !== w || decoBg.height !== h) { decoBg.width = w; decoBg.height = h; } if (decoTop.width !== w || decoTop.height !== h) { decoTop.width = w; decoTop.height = h; } }
    markDecoGeometryDirty();
  }

  function markTilesDirty() { tilesDirty = true; }
  function markDecoGeometryDirty() { decoGeometryDirty = true; }

  function ensureTilesBuffer() {
    if (!tilesBuffer) {
      tilesBuffer = document.createElement('canvas');
      tilesBufferCtx = tilesBuffer.getContext('2d');
    }
  }

  function tileNamesForSelection(scn, sel) {
    const names = new Set();
    if (!scn) return names;
    for (const [cell, baseName] of Object.entries(scn.tiles || {})) {
      names.add(resolveTileName(baseName, sel));
      const variant = scn.variants?.[cell]?.[sel];
      if (variant) names.add(variant);
    }
    return names;
  }

  function queueDeferredTileLoads(names) {
    names.forEach((name) => {
      if (!name || tileCache[name]) return;
      if (deferredTiles.has(name)) return;
      deferredTiles.add(name);
      runDeferred(() => {
        deferredTiles.delete(name);
        getTileImage(name);
      });
    });
  }

  function ensureSelectionTiles(scn) {
    const now = tileNamesForSelection(scn, selected);
    now.forEach((name) => getTileImage(name));
  }

  function renderTilesIntoBuffer() {
    if (!currentScenario || !canvas) return;
    ensureTilesBuffer();
    if (!tilesBufferCtx) return;
    if (tilesBuffer.width !== canvas.width) tilesBuffer.width = canvas.width;
    if (tilesBuffer.height !== canvas.height) tilesBuffer.height = canvas.height;
    tilesBufferCtx.clearRect(0, 0, tilesBuffer.width, tilesBuffer.height);
    drawTiles(currentScenario, tilesBufferCtx);
    tilesDirty = false;
  }

  function ensureDecoGeometry() {
    if (!decoGeometryDirty && decoGeometry) return decoGeometry;
    if (!wrapEl || !canvas) return null;
    const wrapBB = wrapEl.getBoundingClientRect();
    const boardBB = canvas.getBoundingClientRect();
    if (!wrapBB.width || !wrapBB.height || !boardBB.width || !boardBB.height) {
      return null;
    }
    const outsideRect = { x: 0, y: 0, w: wrapBB.width, h: wrapBB.height };
    const offX = boardBB.left - wrapBB.left;
    const offY = boardBB.top - wrapBB.top;
    const sxBoard = canvas.width / Math.max(1, boardBB.width);
    const syBoard = canvas.height / Math.max(1, boardBB.height);
    const insideRect = { x: offX, y: offY, w: boardBB.width, h: boardBB.height };
    const transform = { sx: sxBoard, sy: syBoard, tx: -offX * sxBoard, ty: -offY * syBoard };
    decoGeometry = { outsideRect, insideRect, transform };
    decoGeometryDirty = false;
    return decoGeometry;
  }

  const Loader = {
    el: null,
    ensure(scopeEl){ if (this.el) return; const host = scopeEl || document.querySelector('.stage'); const overlay = document.createElement('div'); overlay.id = 'stageLoaderOverlay'; const bgVar = getComputedStyle(host).getPropertyValue('--panel') || '#166659'; Object.assign(overlay.style, { position:'absolute', inset:'0', display:'none', alignItems:'center', justifyContent:'center', background: bgVar || '#166659', zIndex:50 }); overlay.innerHTML = `
      <div id="loader" aria-label="Cargando">
        <div class="rails"><div class="rail-left"></div><div class="rail-right"></div></div>
        <div class="block"><span></span></div>
        <div class="block b2"><span></span></div>
        <div class="block b3"><span></span></div>
        <div class="block b4"><span></span></div>
        <div class="block b5"><span></span></div>
      </div>`; host.style.position = host.style.position || 'relative'; host.appendChild(overlay); this.el = overlay; },
    show(scopeEl){ this.ensure(scopeEl); this.el.style.display = 'flex'; },
    hide(){ if (!this.el) return; this.el.style.display = 'none'; }
  };

  function masterVol(){ return (window.VolumeSystem?.get?.() ?? 0.5); }
  let bgm = null; let sfx = { train:null, whistle:null, sw:null };
  function ensureBGM(){ if (bgm) return bgm; bgm = new Audio('/games/2/audio/background_music.mp3'); bgm.loop = true; bgm.preload = 'auto'; bgm.muted = false; bgm.setAttribute('playsinline',''); bgm.setAttribute('webkit-playsinline',''); window.VolumeSystem?.attachMedia?.(bgm); const setElemVol = (v)=>{ try { bgm.volume = 0.5 * v; } catch(_){} }; setElemVol(masterVol()); window.VolumeSystem?.onChange?.(setElemVol); return bgm; }
  function ensureSFX(){ if (!sfx.train){ sfx.train = new Audio('/games/2/audio/train_loop.mp3'); sfx.train.loop = true; sfx.train.preload = 'auto'; sfx.train.setAttribute('playsinline',''); sfx.train.setAttribute('webkit-playsinline',''); window.VolumeSystem?.attachMedia?.(sfx.train); const setV=(v)=>{ try { sfx.train.volume = v; } catch(_){} }; setV(masterVol()); window.VolumeSystem?.onChange?.(setV); }
    if (!sfx.whistle){ sfx.whistle = new Audio('/games/2/audio/whistle.mp3'); sfx.whistle.preload = 'auto'; sfx.whistle.setAttribute('playsinline',''); sfx.whistle.setAttribute('webkit-playsinline',''); window.VolumeSystem?.attachMedia?.(sfx.whistle); const setV=(v)=>{ try { sfx.whistle.volume = v; } catch(_){} }; setV(masterVol()); window.VolumeSystem?.onChange?.(setV); }
    if (!sfx.sw){ sfx.sw = new Audio('/games/2/audio/switch.mp3'); sfx.sw.preload = 'auto'; sfx.sw.setAttribute('playsinline',''); sfx.sw.setAttribute('webkit-playsinline',''); window.VolumeSystem?.attachMedia?.(sfx.sw); const setV=(v)=>{ try { sfx.sw.volume = v; } catch(_){} }; setV(masterVol()); window.VolumeSystem?.onChange?.(setV); }
    return sfx; }

  let DIM = { cols: 5, rows: 9, tileSize: CONFIG.TILE_BASE_SIZE };
  let assets = { train: null, wagon: null };
  let allQuestions = null; let activeQuestions = []; let feedback = { success: [], fail: [] };
  let scenariosCache = []; let finalScenario = null; let currentScenario = null;
  let questionsTotal = 0; let currentQIndex = -1; let currentQView = null;
  let selected = 'A'; let userChoseThisRound = false;
  let score = CONFIG.MAX_SCORE_PERFECT; let errors = 0; let wagons = 0; let lost = false; let lastScore = CONFIG.MAX_SCORE_PERFECT;
  let scoreSubmitted = false; let scoreSubmitError = null;
  let questionOutcomes = [];
  let routeQuestion = []; let cumRoute = []; let sHead = 0; let headAngle = 0; let targetAngle = 0; let lastTs = null; let waitUntil = 0; let animT = 0;
  let bgCurr = { r: 77, g: 121, b: 83 };

  function setSelected(v){
    const next = (v === 'A') ? 'A' : 'B';
    const prev = selected;
    selected = next;
    if (prev !== selected) {
      markTilesDirty();
      if (currentScenario) ensureSelectionTiles(currentScenario);
    }
    btnA.classList.toggle('is-selected', selected === 'A');
    btnB.classList.toggle('is-selected', selected === 'B');
  }
  function clearButtonSelection(){ btnA.classList.remove('is-selected'); btnB.classList.remove('is-selected'); }
  function setQuestionVisible(show){ const card = document.querySelector('.question-card'); if (card) card.style.display = show ? '' : 'none'; }
  function animateFade(show) { if (show) fadeEl.classList.add('show'); else fadeEl.classList.remove('show'); if (!show) fadeEl.style.pointerEvents = 'none'; }
  function resetScoreState() {
    score = CONFIG.MAX_SCORE_PERFECT;
    errors = 0;
    wagons = 0;
    lost = false;
    lastScore = score;
    scoreSubmitted = false;
    scoreSubmitError = null;
    currentQIndex = -1;
    currentScenario = null;
    routeQuestion = [];
    cumRoute = [];
    sHead = 0;
    headAngle = 0;
    targetAngle = 0;
    lastTs = null;
    waitUntil = 0;
    userChoseThisRound = false;
    questionOutcomes = [];
    try { scoreLabel.textContent = String(score); } catch {}
    try { errorsLabel.textContent = String(errors); } catch {}
    try { qCounter.textContent = '0'; } catch {}
    try { progressFill.style.width = '0%'; } catch {}
  }

  function computeFinalStats() {
    const totalQuestionsLogged = questionOutcomes.length || 0;
    const correctAnswersLogged = questionOutcomes.filter((entry) => entry?.result === 'correct').length;
    const mistakesLogged = Math.max(0, totalQuestionsLogged - correctAnswersLogged);
    const fallbackTotal = Math.max(0, Math.min(questionsTotal || 0, currentQIndex + 1));
    const totalQuestions = totalQuestionsLogged || fallbackTotal;
    const correctAnswers = totalQuestionsLogged ? correctAnswersLogged : Math.max(0, totalQuestions - errors);
    const mistakes = Math.max(0, totalQuestions - correctAnswers) || mistakesLogged;
    return { totalQuestions, correctAnswers, mistakes };
  }

  function buildScorePayload() {
    const { totalQuestions, correctAnswers, mistakes } = computeFinalStats();
    const lostGame = Boolean(lost);
    const perfectRun = !lostGame && mistakes === 0 && Number(lastScore || 0) >= CONFIG.MAX_SCORE_PERFECT;
    return {
      gameId: 2,
      gameTitle: 'El tren de las decisiones',
      score: Number(lastScore || 0),
      totalQuestions,
      correctAnswers,
      mistakes,
      lost: lostGame,
      perfectRun,
    };
  }

  function registerOutcome(result) {
    const normalized = result === 'correct' || result === 'incorrect' || result === 'skipped'
      ? result
      : 'unknown';
    const id = currentQView?.id || `q${questionOutcomes.length + 1}`;
    questionOutcomes.push({ id, result: normalized });
  }

  function describeScoreError(err) {
    if (!err) return 'No se pudo guardar el puntaje. Intenta nuevamente.';
    const msg = String(err.message || '');
    if (msg.startsWith('api_')) {
      const reason = msg.slice(4);
      if (reason === 'unauthenticated') return 'Tu sesión expiró. Inicia sesión nuevamente.';
      if (reason === 'invalid_payload') return 'El servidor rechazó el puntaje. Recarga la página.';
      return `No se pudo guardar (código: ${reason}).`;
    }
    if (msg.startsWith('http_')) {
      return `Error de red (${msg.slice(5)}). Verifica tu conexión.`;
    }
    return 'No se pudo guardar el puntaje. Intenta nuevamente.';
  }

  async function submitScore() {
    if (scoreSubmitted) return true;
    const payload = buildScorePayload();
    try { console.log('[TrainGame] Sending score payload:', payload); } catch {}
    const body = JSON.stringify(payload);
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
      });
      const raw = await res.text();
      let data = null;
      if (raw) {
        try { data = JSON.parse(raw); } catch {}
      }
      if (!res.ok) {
        throw new Error(`http_${res.status}`);
      }
      if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
        const reason = typeof data.reason === 'string' ? data.reason : 'unknown';
        throw new Error(`api_${reason}`);
      }
      scoreSubmitted = true;
      scoreSubmitError = null;
      return true;
    } catch (err) {
      console.warn('[TrainGame] Score submission failed', err);
      scoreSubmitError = err;
      scoreSubmitted = false;
      return false;
    }
  }

  function resizeCanvas(grid) {
    const tsMin = 32, tsMax = 128;
    const gridCols = grid?.cols || DIM.cols;
    const gridRows = grid?.rows || DIM.rows;

    const isMobile = window.innerWidth < CONFIG.DESKTOP_BP;
    const navEl = document.querySelector('.navbar') || document.querySelector('nav');
    const navH = navEl?.getBoundingClientRect().height || 0;
    const headerH = headerEl?.getBoundingClientRect().height || 0;
    const panelRect = uiPanelEl?.getBoundingClientRect();
    const panelH = isMobile ? (panelRect?.height || 0) : 0;
    const stageStyles = stageEl ? getComputedStyle(stageEl) : null;
    const padTop = parseFloat(stageStyles?.paddingTop || '0') || 0;
    const padBottom = parseFloat(stageStyles?.paddingBottom || '0') || 0;
    const stageGap = parseFloat(stageStyles?.rowGap || stageStyles?.gap || '0') || 0;
    const layoutStyles = stageEl?.parentElement ? getComputedStyle(stageEl.parentElement) : null;
    const layoutGap = parseFloat(layoutStyles?.rowGap || layoutStyles?.gap || '0') || 0;
    const extra = padTop + padBottom + layoutGap + (isMobile ? stageGap : 0) + 24;

    const availH = Math.max(140, window.innerHeight - navH - headerH - panelH - extra);
    wrapEl.style.height = `${Math.floor(availH)}px`;
    const minStage = Math.max(200, window.innerHeight - navH - headerH - layoutGap);
    stageEl.style.minHeight = `${Math.floor(minStage)}px`;

    const padX = 20, padY = 20;
    const maxCanvasW = Math.max(120, wrapEl.clientWidth - padX);
    const maxCanvasH = Math.max(120, wrapEl.clientHeight - padY);
    const tsW = Math.floor(maxCanvasW / gridCols);
    const tsH = Math.floor(maxCanvasH / gridRows);
    const ts  = clamp(Math.min(tsW, tsH), tsMin, tsMax);
    DIM = { cols: gridCols, rows: gridRows, tileSize: ts };
    canvas.width = gridCols * ts;
    canvas.height = gridRows * ts;
    markTilesDirty();
    markDecoGeometryDirty();

    sizeOverlaysToWrap();
  }

  async function preloadTilesForScenario(scn){
    if (!scn) return;
    const currentSel = selected;
    const altSel = currentSel === 'A' ? 'B' : 'A';
    const primary = tileNamesForSelection(scn, currentSel);
    const secondary = tileNamesForSelection(scn, altSel);
    await Promise.all(Array.from(primary).map(getTileImage));
    const deferred = [];
    secondary.forEach((name) => { if (!primary.has(name)) deferred.push(name); });
    queueDeferredTileLoads(deferred);
  }

  async function loadJSON(src){ const r = await fetch(src, { cache:'no-cache' }); return await r.json(); }
  async function loadScenarioRandom(){ if (!scenariosCache.length){ scenariosCache = await Promise.all(CONFIG.SCENARIOS_POOL.map(loadJSON)); scenariosCache.forEach((s,i)=> s.__src = CONFIG.SCENARIOS_POOL[i]); } return scenariosCache[Math.floor(Math.random()*scenariosCache.length)]; }

  function drawTiles(scn, targetCtx = ctx) {
    if (!scn || !targetCtx) return;
    const ts = DIM.tileSize;
    targetCtx.save();
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin='round';
    targetCtx.shadowColor = 'transparent';
    targetCtx.shadowBlur = 0;
    targetCtx.shadowOffsetX = 0;
    targetCtx.shadowOffsetY = 0;
    for (const [cell, baseName] of Object.entries(scn.tiles || {})) {
      const variant = scn.variants?.[cell]?.[selected];
      const name = variant || resolveTileName(baseName, selected);
      const img = tileCache[name];
      const { x, y } = cellTopLeftPx(cell, ts);
      if (img) targetCtx.drawImage(img, x, y, ts, ts); else { targetCtx.fillStyle = '#808080'; targetCtx.fillRect(x, y, ts, ts); }
    }
    targetCtx.restore();
  }

  function drawSprite(img, x, y, angle, isLoco, phase) {
    const ts = DIM.tileSize; const w = Math.floor(ts * 0.72); const h = Math.floor(ts * 0.92);
    const amp = CONFIG.ANIM_WOBBLE_AMPL; const spd = CONFIG.ANIM_WOBBLE_SPEED; const scale = 1 + Math.sin((animT * spd * Math.PI * 2) + (phase || 0)) * amp;
    const shadowBlur = CONFIG.SHADOW_BLUR_FACTOR * ts; const shadowOffX = CONFIG.SHADOW_OFFSET_X_FACTOR * ts; const shadowOffY = CONFIG.SHADOW_OFFSET_Y_FACTOR * ts; const shadowCol = `rgba(0,0,0,${CONFIG.SHADOW_OPACITY})`;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle || 0); ctx.scale(scale, scale); ctx.shadowColor = shadowCol; ctx.shadowBlur = shadowBlur; ctx.shadowOffsetX = shadowOffX; ctx.shadowOffsetY = shadowOffY;
    if (img) { ctx.drawImage(img, -w / 2, -h / 2, w, h); } else { ctx.fillStyle = isLoco ? '#ffd46b' : '#6bd6ff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -h / 2 + 8, 6, 0, Math.PI * 2); ctx.fillStyle = isLoco ? '#ffecb3' : '#d7f1ff'; ctx.fill(); }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function grassColor() { if (state === 'RUN_FINAL' || state === 'FINAL_STOPPED') { return lost ? '#847859' : '#4D7953'; } if (errors <= 0) return '#4D7953'; if (errors === 1) return '#69794D'; if (errors === 2) return '#7B6D3D'; return '#847859'; }

  function drawScene(dt){
    const target = hexToRgb(grassColor());
    const k = 1 - Math.exp(-dt / CONFIG.BG_LERP_TIME);
    const kk = clamp(k, 0, 1);
    bgCurr = { r: lerp(bgCurr.r, target.r, kk), g: lerp(bgCurr.g, target.g, kk), b: lerp(bgCurr.b, target.b, kk) };
    const currCss = rgbToCss(bgCurr);
    ctx.save();
    ctx.fillStyle = currCss;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (wrapEl) wrapEl.style.backgroundColor = currCss;

    if (currentScenario) {
      if (tilesDirty || !tilesBuffer || !tilesBufferCtx || tilesBuffer.width !== canvas.width || tilesBuffer.height !== canvas.height) {
        renderTilesIntoBuffer();
      }
      if (tilesBuffer) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.drawImage(tilesBuffer, 0, 0);
        ctx.restore();
      }
    }
  }
  function hexToRgb(hex) { const h = hex.replace('#', '').trim(); const v = parseInt(h, 16); return { r: (v>>16)&255, g: (v>>8)&255, b: v&255 }; }
  function rgbToCss({ r, g, b }) { return `rgb(${r|0}, ${g|0}, ${b|0})`; }

  function drawDecoLayers(){
    if (!decoBgCtx || !decoTopCtx) return;
    decoBgCtx.clearRect(0,0,decoBg.width,decoBg.height);
    decoTopCtx.clearRect(0,0,decoTop.width,decoTop.height);

    const geo = ensureDecoGeometry();
    if (!geo) return;
    const { outsideRect, insideRect, transform } = geo;

    Deco.draw(decoBgCtx, 'belowTracks');
    Deco.draw(decoBgCtx, 'aboveTracks', { clip:'outside', rect: outsideRect });
    Deco.draw(ctx, 'aboveTracks', { clip:'inside', rect: insideRect, transform });
    Deco.draw(decoTopCtx, 'aboveTrain');
    Deco.drawPost(decoTopCtx);
  }

  let state = 'INTRO';

  function stepRun(dt, lockOnLast, isFinal = false) {
    if (!cumRoute || cumRoute.length < 2) return;
    const speed = CONFIG.TRAIN_SPEED * (DIM.tileSize / CONFIG.TILE_BASE_SIZE);
    const endS  = cumRoute[cumRoute.length - 1].s;
    sHead = clamp(sHead + speed * dt, 0, endS);
    const nowPos = posOnRoute(cumRoute, sHead);
    if (nowPos.angle != null) targetAngle = nowPos.angle; headAngle = lerpAngle(headAngle, targetAngle, 0.25);
    if (lockOnLast && state === 'RUN_QUESTION') { const lastQ = endS; if (sHead >= lastQ - 0.1) { startAnswerPhase(); return; } }
    drawTrainAndWagons(nowPos, sHead, cumRoute, isFinal);
    if (sHead >= endS - 0.001) {
      if (state === 'RUN_ANSWER') {
        state = 'TRANSITION';
        finishAnswerPhaseOnce();
      } else if (state === 'RUN_FINAL') {
        finalEl.classList.remove('hidden');
        try { unlockNav(); } catch {}
        state = 'FINAL_STOPPED';
      }
    }
  }

  function drawTrainAndWagons(nowPos, s, cum, isFinal){
    const loco = assets.train;
    const wagon = assets.wagon;
    const spacing = DIM.tileSize * 0.9;
    for (let i = wagons - 1; i >= 0; i--) {
      const idx = i + 1;
      const ss = Math.max(0, s - idx * spacing);
      const pos = posOnRoute(cum, ss);
      const ang = pos.angle != null ? pos.angle : headAngle;
      drawSprite(wagon, pos.x, pos.y, ang, false, idx * CONFIG.ANIM_WOBBLE_PHASE_WAGON);
    }
    drawSprite(loco, nowPos.x, nowPos.y, headAngle, true, 0);
  }

  async function nextQuestion(showLoader=false) {
    currentQIndex++; if (currentQIndex >= questionsTotal) { startFinalScene(); return; } if (lost) { startFinalScene(); return; }
    setSelected(Math.random() < CONFIG.RANDOM_DEFAULT_BIAS ? 'A' : 'B'); userChoseThisRound = false; clearButtonSelection(); setQuestionVisible(true);
    const baseQ = activeQuestions[currentQIndex]; currentQView = { id: baseQ.id || `q${currentQIndex + 1}`, text: baseQ.text, optionA: baseQ.optionA, optionB: baseQ.optionB, correct: baseQ.correct === 'A' ? 'A' : 'B' };
    if (Math.random() < CONFIG.SHUFFLE_AB_PROB) { const tmp = currentQView.optionA; currentQView.optionA = currentQView.optionB; currentQView.optionB = tmp; currentQView.correct = (currentQView.correct === 'A') ? 'B' : 'A'; }
    qCounter.textContent = String(currentQIndex + 1); progressFill.style.width = `${((currentQIndex) / (questionsTotal)) * 100}%`;
    elQuestion.textContent = currentQView.text; btnA.textContent = currentQView.optionA; btnB.textContent = currentQView.optionB;
    currentScenario = await loadScenarioRandom();
    markTilesDirty();
    ensureSelectionTiles(currentScenario);
    if (showLoader) Loader.show(stageEl);
    await preloadTilesForScenario(currentScenario);
    resizeCanvas(currentScenario.grid);
    if (decoBg && decoTop) { const decoSeed = `${currentScenario.id || currentScenario.__src}|q${currentQIndex}|${decoBg.width}x${decoBg.height}`; await Deco.rebuild(decoSeed); }
    if (showLoader) Loader.hide();
    routeQuestion = buildRoutePoints(currentScenario.sequence.question, DIM.tileSize);
    setCurrentRoute(routeQuestion, 'none');
    headAngle = 0; targetAngle = 0; lastTs = null; state = 'WAIT_QUESTION'; waitUntil = performance.now() + CONFIG.PREMOVE_DELAY_MS;
  }

  function buildAnswerRouteFromSelection(preserveMode = 'none') {
    if (!currentScenario) return;
    const ansSeq = (selected === 'A') ? currentScenario.sequence.answerA : currentScenario.sequence.answerB;
    const ansPts = buildRoutePoints(ansSeq, DIM.tileSize);
    const merged = [...routeQuestion, ...ansPts];
    setCurrentRoute(merged, preserveMode);
  }

  function startAnswerPhase() {
    if (!userChoseThisRound) {
      registerOutcome('skipped');
      errors++;
      if (errors > CONFIG.MAX_ERRORS) lost = true;
      score = clamp(CONFIG.MAX_SCORE_PERFECT - errors * CONFIG.PENALTY_PER_ERROR, 0, CONFIG.MAX_SCORE_PERFECT);
      lastScore = score;
      errorsLabel.textContent = String(errors);
      scoreLabel.textContent  = String(score);
      showToast('Debes elegir A o B');
      state = 'TRANSITION';
      finishAnswerPhaseOnce();
      return;
    }
    try { const fx = ensureSFX().whistle; fx.currentTime = 0; fx.play(); } catch(_){}
    buildAnswerRouteFromSelection('absolute');
    const isCorrect = (selected === currentQView.correct);
    if (!isCorrect) {
      registerOutcome('incorrect');
      errors++;
      if (errors > CONFIG.MAX_ERRORS) lost = true;
      score = clamp(CONFIG.MAX_SCORE_PERFECT - errors * CONFIG.PENALTY_PER_ERROR, 0, CONFIG.MAX_SCORE_PERFECT);
      lastScore = score;
      errorsLabel.textContent = String(errors);
      scoreLabel.textContent  = String(score);
      showToast('Incorrecto', false);
    } else {
      registerOutcome('correct');
      wagons++;
      lastScore = score;
      console.log('[TrainGame] Wagon count:', wagons);
      showToast('Correcto!', true);
    }
    state = 'RUN_ANSWER';
  }

  async function finishAnswerPhaseOnce() { animateFade(true); await waitMs(CONFIG.FADE_DURATION_MS); if (lost) { await startFinalScene(); return; } if (currentQIndex + 1 >= questionsTotal) { await startFinalScene(); } else { await nextQuestion(true); animateFade(false); } }

  async function startFinalScene() {
    if (state === 'RUN_FINAL' || state === 'FINAL_STOPPED') return;
    state = 'TRANSITION';
    animateFade(true);
    await waitMs(CONFIG.FADE_DURATION_MS);

    const { totalQuestions, correctAnswers, mistakes } = computeFinalStats();
    const lostGame = lost;
    const computedScore = clamp(CONFIG.MAX_SCORE_PERFECT - mistakes * CONFIG.PENALTY_PER_ERROR, 0, CONFIG.MAX_SCORE_PERFECT);
    score = Math.min(score, computedScore);
    lastScore = score;

    const perfectRun = !lostGame && mistakes === 0;
    let finalTitle = CONFIG.MESSAGES.winTitle;
    let finalBody = CONFIG.MESSAGES.winBody;

    if (lostGame) {
      finalTitle = CONFIG.MESSAGES.loseTitle;
      finalBody = CONFIG.MESSAGES.loseBody;
    } else if (!perfectRun) {
      const pluralWord = mistakes === 1 ? 'desvio' : 'desvios';
      finalTitle = 'Ruta con desvios';
      finalBody = `Llegaste al destino, pero cometiste ${mistakes} ${pluralWord}. Sigue reforzando tus decisiones en la via correcta.`;
    }

    const totalShown = totalQuestions || (correctAnswers + mistakes) || questionsTotal || 0;
    const statsLine = `Puntaje: <strong>${lastScore}</strong> | Aciertos: <strong>${correctAnswers}</strong>/${totalShown}`;
    finalTitleNode.textContent = finalTitle;
    finalBodyNode.innerHTML = `${finalBody} <br> ${statsLine}`;
    console.log('[TrainGame] Final stats:', { score: lastScore, correctAnswers, mistakes, totalQuestions, lost: lostGame });
    setQuestionVisible(false);
    await preloadTilesForScenario(finalScenario);
    markTilesDirty();
    ensureSelectionTiles(finalScenario);
    resizeCanvas(finalScenario.grid);
    currentScenario = finalScenario;
    const route = buildRoutePoints(finalScenario.sequence.final, DIM.tileSize);
    setCurrentRoute(route, 'none');
    headAngle = 0;
    targetAngle = 0;
    Loader.show(stageEl);
    if (decoBg && decoTop) { const decoSeed = `final|${decoBg.width}x${decoBg.height}`; await Deco.rebuild(decoSeed); }
    Loader.hide(); state = 'RUN_FINAL'; animateFade(false);
    submitScore().then((ok) => {
      if (!ok) {
        try { showToast(describeScoreError(scoreSubmitError)); } catch {}
      }
    });
  }

  function ensureToast(){ if (document.getElementById('toastMsg')) return; const d = document.createElement('div'); d.id = 'toastMsg'; d.className = 'toast'; wrapEl.style.position = wrapEl.style.position || 'relative'; wrapEl.appendChild(d); }
  let toastTimer = null; function showToast(text) { const t = document.getElementById('toastMsg'); if (!t) return; t.textContent = text; if (toastTimer) clearTimeout(toastTimer); t.style.transform = 'translateX(-50%) translateY(-6px)'; requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0px)'; }); toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(-6px)'; }, 1200); }

  function loop(ts) { rafId = requestAnimationFrame(loop); if (lastTs == null) lastTs = ts; const dt = (ts - lastTs) / 1000; lastTs = ts; animT += dt; drawScene(dt); if (Deco.hasAnimatedContent?.()) { Deco.update(dt); } drawDecoLayers(); switch (state) { case 'INTRO': break; case 'WAIT_QUESTION': { if (ts >= waitUntil) { state = 'RUN_QUESTION'; } const pos = posOnRoute(cumRoute, sHead); drawTrainAndWagons(pos, sHead, cumRoute, false); break; } case 'RUN_QUESTION': { stepRun(dt, true); break; } case 'RUN_ANSWER':   { stepRun(dt, false); break; } case 'RUN_FINAL':    { stepRun(dt, false, true); break; } case 'TRANSITION':   { break; } case 'FINAL_STOPPED': { const pos = posOnRoute(cumRoute, sHead); drawTrainAndWagons(pos, sHead, cumRoute, true); break; } } }

  let rafId = 0;
  async function boot(){
    ensureDecoCanvases(); ensureToast();
    const fetchJson = async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        return await res.json();
      } catch {
        return null;
      }
    };

    const [questionsData, feedbackData, finalScenarioData] = await Promise.all([
      fetchJson(CONFIG.QUESTIONS_FILE),
      fetchJson(CONFIG.FEEDBACK_FILE),
      fetchJson(CONFIG.FINAL_SCENARIO),
    ]);

    allQuestions = questionsData?.items || [];
    feedback = {
      success: Array.isArray(feedbackData?.success) ? feedbackData.success : [],
      fail: Array.isArray(feedbackData?.fail) ? feedbackData.fail : [],
    };
    finalScenario = finalScenarioData || { grid:{ cols:5, rows:9 }, sequence:{ final: ['C9','C8','C7','C6','C5'] }, tiles:{} };

    const finalTilesPromise = preloadTilesForScenario(finalScenario);
    const [trainImg, wagonImg] = await Promise.all([
      loadImage('/games/2/assets/img/locomotive.png'),
      loadImage('/games/2/assets/img/wagon.png')
    ]);
    assets.train = trainImg;
    assets.wagon = wagonImg;
    await finalTilesPromise;

    activeQuestions = sampleWithoutReplacement(allQuestions, CONFIG.QUESTIONS_PER_RUN);
    questionsTotal = activeQuestions.length; qTotal.textContent = String(questionsTotal);

    const runResizePass = async () => {
      try {
        const base = (state === 'RUN_FINAL' || state === 'FINAL_STOPPED')
          ? 'final'
          : (currentScenario?.id || currentScenario?.__src || '');

        sizeOverlaysToWrap();

        if (currentScenario) {
          resizeCanvas(currentScenario.grid);

          if (state === 'RUN_FINAL' || state === 'FINAL_STOPPED' || (state === 'TRANSITION' && currentScenario === finalScenario)) {
            const route = buildRoutePoints(finalScenario.sequence.final, DIM.tileSize);
            setCurrentRoute(route, 'ratio');
          } else if (state === 'RUN_ANSWER') {
            routeQuestion = buildRoutePoints(currentScenario.sequence.question, DIM.tileSize);
            buildAnswerRouteFromSelection('ratio');
          } else {
            routeQuestion = buildRoutePoints(currentScenario.sequence.question, DIM.tileSize);
            setCurrentRoute(routeQuestion, 'ratio');
          }
        } else {
          resizeCanvas({ cols: DIM.cols, rows: DIM.rows });
        }

        ensureDecoGeometry();

        if (decoBg && decoTop) {
          const decoSeed = `${base}|q${currentQIndex}|${decoBg.width}x${decoBg.height}`;
          await Deco.rebuild(decoSeed);
        }
      } catch {}
    };

    const onResized = () => {
      if (resizeRaf != null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        runResizePass().catch(() => {});
      });
    };
    window.addEventListener('resize', onResized, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResized, { passive: true });
    try { const ro = new ResizeObserver(() => onResized()); if (uiPanelEl) ro.observe(uiPanelEl); } catch {}
    onResized();

    async function handleFinalConfirm() {
      if (btnEndAction.disabled) return;
      const prev = btnEndAction.textContent;
      try { btnEndAction.disabled = true; btnEndAction.textContent = 'Guardando...'; btnEndAction.setAttribute('aria-busy','true'); btnEndAction.style.opacity = '0.7'; } catch {}

      let redirected = false;
      try {
        const saved = await submitScore();
        if (!saved) {
          showToast(describeScoreError(scoreSubmitError));
        } else {
          redirected = true;
          window.location.href = '/admin/scores';
        }
      } catch (err) {
        console.warn('[TrainGame] Error al procesar el guardado final', err);
      } finally {
        if (!redirected) {
          try {
            btnEndAction.disabled = false;
            btnEndAction.textContent = prev || 'Continuar';
            btnEndAction.removeAttribute('aria-busy');
            btnEndAction.style.opacity = '';
          } catch {}
        }
      }
    }

    if (btnEndAction) {
      btnEndAction.addEventListener('click', handleFinalConfirm);
    }

    await Deco.init({ canvas: decoBg, getScenario: () => currentScenario, getGrid: () => DIM, getTrackMask: () => {
      const rects = [];
      if (!currentScenario) return rects;
      const ts = DIM.tileSize;
      for (const [cell, baseName] of Object.entries(currentScenario.tiles || {})) {
        const variant = currentScenario.variants?.[cell]?.[selected];
        const resolved = (variant || resolveTileName(baseName, selected));
        if (!/^track_|^switch_/i.test(resolved)) continue;
        const { x, y } = cellTopLeftPx(cell, ts);
        const wrapBB  = wrapEl.getBoundingClientRect();
        const boardBB = canvas.getBoundingClientRect();
        const offX = boardBB.left - wrapBB.left;
        const offY = boardBB.top  - wrapBB.top;
        const scaleX = boardBB.width  / canvas.width;
        const scaleY = boardBB.height / canvas.height;
        rects.push({ x: offX + x*scaleX, y: offY + y*scaleY, w: ts*scaleX, h: ts*scaleY });
      }
      return rects;
    }, getErrorTier: () => Math.min(errors, 3) });

    // Intro overlay
    ensureIntroOverlay(); showIntroOverlay(true);
    rafId = requestAnimationFrame(loop);
  }

  function ensureIntroOverlay(){ if (document.getElementById('gameIntro')) return; const tpl = document.createElement('div'); tpl.id = 'gameIntro'; tpl.className = 'overlay'; tpl.innerHTML = `
    <div class="overlay__card" style="max-width:560px">
      <h2 id="introTitle" style="margin-top:0">Cómo jugar</h2>
      <p id="introBody" style="opacity:.9">Lee la pregunta y elige A (izquierda) o B (derecha). Puedes cambiar de opinión hasta llegar a la bifurcación. Se permiten 2 errores; al tercero termina el juego. ¡Suerte!</p>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
        <button id="introStart" class="answer-btn">Entendido, comenzar</button>
      </div>
    </div>`; const host = document.getElementById('app') || document.body; host.appendChild(tpl); }
  function showIntroOverlay(show){ const el = document.getElementById('gameIntro'); if (!el) return; el.classList.toggle('hidden', !show); const btn = document.getElementById('introStart'); if (btn) { btn.onclick = async () => { el.classList.add('hidden'); try { ensureBGM().play(); ensureSFX().train.play(); } catch(_){} await beginGameFromIntro(); }; } }

  async function beginGameFromIntro(){
    try { ensureBGM().play(); ensureSFX().train.play(); } catch(_){}
    try { lockNav(); } catch {}
    resetScoreState();
    setQuestionVisible(true);
    Loader.show(stageEl);
    await nextQuestion(true);
    Loader.hide();
    animateFade(false);
  }

  btnA.addEventListener('click', () => { if (state === 'RUN_QUESTION' || state === 'WAIT_QUESTION'){ userChoseThisRound = true; setSelected('A'); try { const fx = ensureSFX().sw; fx.currentTime = 0; fx.play(); } catch(_){} } });
  btnB.addEventListener('click', () => { if (state === 'RUN_QUESTION' || state === 'WAIT_QUESTION'){ userChoseThisRound = true; setSelected('B'); try { const fx = ensureSFX().sw; fx.currentTime = 0; fx.play(); } catch(_){} } });

  boot();

  return () => {
    try { unlockNav(); } catch {}
    try { cancelAnimationFrame(rafId); } catch {}
  };
}

function sampleWithoutReplacement(arr, k) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, Math.min(k, a.length)); }
