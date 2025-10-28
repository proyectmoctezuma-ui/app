export function initEscalerasGame() {
  if (typeof window === "undefined") return () => {};

  const GAME_ID = 3;
  const GAME_TITLE = "Escaleras verdes";
  const ASSET_BASE = "/games/3";
  const JSON_PATH = `${ASSET_BASE}/json/board_eco.json`;
  const IMG_BASE = `${ASSET_BASE}/img`;
  const AUDIO_DIR = `${ASSET_BASE}/audio/`;
  // ------------------ Configuración ------------------
  const CONFIG = {
    timeLimitSec: 120,
    pointsOnWin: 40,
    mustLandExact: false,           // si true y te pasas, no te mueves
    exceedBehavior: "stay",         // "stay" | "bounce" (usado sólo si mustLandExact=true)
    dice: {
      overlayOpacity: 0.25,
      animMinMs: 1000,
      animMaxMs: 2000,
      frameMs: 80,
      postRollPauseMs: 1500,
      shake: {
        maxTranslatePx: 6,
        maxRotateDeg: 6,
        rampUp: 0.25,
        rampDown: 0.25
      }
    },
    move: {
      stepDurationMs: 600,          // A -> B (un paso)
      pauseBetweenStepsMs: 130,     // pausa entre pasos
      jumpBaseMs: 700,              // duración base para saltos directos (serp/esc)
      easing: "easeInOutQuad"
    },
    ui: {
      desktopMinWidth: 992
    },
    audio: {
      enabled: true,
      // Usa tu ruta actual del BGM. Si prefieres local: "audio/background_music.mp3".
      src: `${AUDIO_DIR}background_music.mp3`,
      base: AUDIO_DIR,
      volume: 0.5
    },
    debug: {
      showGuides: false,
      seededRng: false,
      seed: 123456
    }
  };

  const cleanupFns = [];
  let destroyed = false;
  const rootEl = document.getElementById("app");
  if (!rootEl) {
    console.error("[Escaleras] No se encontró el contenedor del juego (#app).");
    return () => {};
  }

  let scoreSubmitted = false;
  let gameHasFinished = false;
  let finalPromptAcknowledged = false;

  function emitGameFinished(payload) {
    if (gameHasFinished) return;
    gameHasFinished = true;
    try { console.log("[Escaleras] Juego finalizado:", payload); } catch {}
    try { window.onGameComplete?.(payload); } catch {}
  }

  function emitFinalPromptAccepted(payload) {
    if (finalPromptAcknowledged) return;
    finalPromptAcknowledged = true;
    try { console.log("[Escaleras] Prompt final confirmado:", payload); } catch {}
  }

  async function postScore(result) {
    if (scoreSubmitted) return;
    const payload = {
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      score: Number(score || 0),
      timeLeft: Math.max(0, Number(timeLeft || 0)),
      result,
      finishedAt: Date.now(),
    };
    let res;
    try {
      res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
    } catch (err) {
      throw err;
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || data?.ok === false) {
      const reason = data?.reason || res.statusText || `status ${res.status}`;
      throw new Error(reason);
    }
    scoreSubmitted = true;
  }

  async function handleFinalAccept(result, btn) {
    if (!btn) return true;
    emitFinalPromptAccepted({
      gameId: GAME_ID,
      result,
      score: Number(score || 0),
      timeLeft: Math.max(0, Number(timeLeft || 0))
    });
    if (scoreSubmitted) {
      try { window.location.href = "/admin/scores"; } catch {}
      return true;
    }
    const prevLabel = btn.textContent;
    try {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.style.opacity = "0.7";
      btn.textContent = "Guardando...";
      await postScore(result);
      try {
        window.location.href = "/admin/scores";
      } catch {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.style.opacity = "";
        btn.textContent = prevLabel || "Continuar";
      }
      return true;
    } catch (err) {
      console.warn("[Escaleras] Error al guardar puntaje:", err);
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.style.opacity = "";
      btn.textContent = prevLabel || "Reintentar";
      return false;
    }
  }

  function resolveAsset(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return path;
    return `${ASSET_BASE}/${path}`.replace(/\/{2,}/g, "/").replace(/\/+\./g, "/.");
  }

  const DICE_FRAMES = [1, 2, 3, 4, 5, 6].map(n => `${IMG_BASE}/dados/${n}.png`);
  let boardAspect = 1080 / 1920;

  // ------------------ Estado ------------------
  const State = {
    LOADING: "LOADING",
    INTRO: "INTRO",
    IDLE: "IDLE",
    ROLLING: "ROLLING",
    POST_ROLL_PAUSE: "POST_ROLL_PAUSE",
    MOVING_STEPS: "MOVING_STEPS",
    CELL_PROMPT: "CELL_PROMPT",
    JUMPING: "JUMPING",
    END_WIN: "END_WIN",
    END_TIMEUP: "END_TIMEUP"
  };

  let state = State.LOADING;
  let json = null;
  let design = null;
  let path = [];
  let cells = [];
  let positions = [];
  let startPos = null;
  let goalPos = null;

  let isDesktop = false;
  let timeLeft = CONFIG.timeLimitSec;
  let timerId = null;
  let timeExpired = false;

  let score = 0;
  let currIndex = -1;      // -1 = INICIO
  let lastIndex = -1;      // 0..(N-1)
  let metaIndex = -1;      // lastIndex + 1

  function setFixedBlockHeight(el, heightPx) {
    if (!el) return;
    el.style.height = heightPx;
    el.style.minHeight = heightPx;
    el.style.maxHeight = heightPx;
  }

  function clearFixedBlockHeight(el) {
    if (!el) return;
    el.style.height = "";
    el.style.minHeight = "";
    el.style.maxHeight = "";
  }

  // RNG (semilla opcional)
  let rng = Math.random;
  if (CONFIG.debug.seededRng) {
    let s = CONFIG.debug.seed >>> 0;
    rng = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 0xFFFFFFFF;
    };
  }

  // ------------------ DOM ------------------
  const boardWrapEl = document.getElementById("boardWrap");
  const boardEl = document.getElementById("board");
  const pieceEl = document.getElementById("piece");
  const debugCanvas = document.getElementById("debugCanvas");

  const timeLabel = document.getElementById("timeLabel");
  const scoreLabel = document.getElementById("scoreLabel");
  const timeLabelDesktop = document.getElementById("timeLabelDesktop");
  const scoreLabelDesktop = document.getElementById("scoreLabelDesktop");

  const rollBtn = document.getElementById("rollButton");                // móvil
  const rollBtnDesk = document.getElementById("rollButtonDesktop");     // desktop

  const diceOverlay = document.getElementById("diceOverlay");
  const diceImgOverlay = document.getElementById("diceImgOverlay");
  const diceImgPanel = document.getElementById("diceImgPanel");
  const dicePanel = document.getElementById("dicePanel");

  const promptModal = document.getElementById("promptModal");
  const promptImage = document.getElementById("promptImage");
  const promptTitle = document.getElementById("promptTitle");
  const promptText = document.getElementById("promptText");
  const promptAccept = document.getElementById("promptAccept");
  const promptClose = document.getElementById("promptClose");

  const systemModal = document.getElementById("systemModal");
  const systemTitle = document.getElementById("systemTitle");
  const systemText = document.getElementById("systemText");
  const systemAccept = document.getElementById("systemAccept");
  const topbarEl = rootEl.querySelector(".topbar");
  const bottomCtaEl = rootEl.querySelector(".bottom-cta");
  const sidePanelEl = document.getElementById("sidePanel");
  const layoutEl = rootEl.querySelector(".layout");

  if (!boardWrapEl || !boardEl || !pieceEl || !diceOverlay || !promptModal || !systemModal) {
    console.error("[Escaleras] Elementos base no encontrados en el DOM.");
    return () => {};
  }

  // ------------------ Dado (anim) ------------------
  let diceAnimTimer = null;
  let diceAnimStopFn = null;
  let shakeStopFn = null;

  // ------------------ Prompt (anti-parpadeo) ------------------
  let promptToken = 0;

  // ------------------ Audio (BGM + SFX con VolumeSystem) ------------------
  let bgm = null;
  let masterVolume = CONFIG.audio.volume;

  const AUDIO_BASE = CONFIG.audio.base || AUDIO_DIR;
  const SFX = {
    dice: ["dice_01.mp3", "dice_02.mp3", "dice_03.mp3"].map(f => AUDIO_BASE + f),
    drag: ["drag_01.mp3", "drag_02.mp3"].map(f => AUDIO_BASE + f)
  };

  // Precarga “plantilla” (no se reproducen estos, clonamos al volar)
  const sfxDiceEls = SFX.dice.map(src => { const a = new Audio(src); a.preload = "auto"; return a; });
  const sfxDragEls = SFX.drag.map(src => { const a = new Audio(src); a.preload = "auto"; return a; });

  const activeSfx = new Set();

  function getMasterVolume() {
    if (window.VolumeSystem?.get) return window.VolumeSystem.get();
    return masterVolume;
  }

  function hookVolumeSystem() {
    if (window.VolumeSystem?.onChange) {
      try { masterVolume = window.VolumeSystem.get(); } catch (_) { }
      const unsubscribe = window.VolumeSystem.onChange(v => {
        masterVolume = v;
        // si NO hay AudioContext, caemos al volumen nativo
        if (!window.VolumeSystem.hasAudioContext) {
          if (bgm) bgm.volume = v;
          activeSfx.forEach(a => { try { a.volume = v; } catch (_) { } });
        }
        // si hay AudioContext, el volumen lo aplica el masterGain (no tocar .volume)
      });
      if (typeof unsubscribe === "function") {
        cleanupFns.push(() => {
          try { unsubscribe(); } catch {}
        });
      }
      // primer sync
      if (!window.VolumeSystem.hasAudioContext && bgm) bgm.volume = masterVolume;
    } else {
      const retryId = setTimeout(hookVolumeSystem, 500);
      cleanupFns.push(() => clearTimeout(retryId));
    }
  }

  function initBgm() {
    if (bgm || !CONFIG.audio.enabled) return;
    bgm = new Audio();
    bgm.src = CONFIG.audio.src;
    bgm.loop = true;
    bgm.preload = "auto";
    // Conectar al bus maestro si existe (iOS).
    const attached = window.VolumeSystem?.attachMedia ? window.VolumeSystem.attachMedia(bgm) : false;
    if (attached || window.VolumeSystem?.hasAudioContext) {
      // Cuando hay bus, dejamos .volume en 1 y controlamos por masterGain.
      bgm.volume = 1;
    } else {
      // Fallback desktop
      bgm.volume = getMasterVolume();
    }
    // iOS hints (por si attachMedia no estuvo disponible aún)
    bgm.setAttribute?.('playsinline', '');
    bgm.setAttribute?.('webkit-playsinline', '');
  }

  async function ensureAudioPlaying() {
    if (!CONFIG.audio.enabled) return;
    initBgm();
    if (!bgm) return;
    try {
      if (bgm.paused) await bgm.play();
    } catch (_) { }
  }

  function playSfxFrom(listEls) {
    if (!listEls?.length) return;
    const el = listEls[Math.floor(Math.random() * listEls.length)];
    const a = el.cloneNode(); // reproducimos sobre clones
    a.preload = "auto";

    // Conectar al master bus (iOS)
    const attached = window.VolumeSystem?.attachMedia ? window.VolumeSystem.attachMedia(a) : false;
    if (attached || window.VolumeSystem?.hasAudioContext) {
      a.volume = 1;
    } else {
      a.volume = getMasterVolume();
    }

    // iOS hints
    a.setAttribute?.('playsinline', '');
    a.setAttribute?.('webkit-playsinline', '');
    a.muted = false;

    activeSfx.add(a);
    a.addEventListener("ended", () => activeSfx.delete(a));
    a.addEventListener("error", () => activeSfx.delete(a));
    a.play().catch(() => { activeSfx.delete(a); });
  }
  const playDiceSfx = () => playSfxFrom(sfxDiceEls);
  const playDragSfx = () => playSfxFrom(sfxDragEls);


  // ------------------ Utilidades ------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const Easings = {
    easeInOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  };

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function setState(next) {
    if (destroyed) return;
    state = next;
    updateUIState();
  }

  function updateUIState() {
    if (destroyed) return;
    const canRoll = (state === State.IDLE && !timeExpired);
    if (rollBtn) rollBtn.disabled = !canRoll;
    if (rollBtnDesk) rollBtnDesk.disabled = !canRoll;
  }

  function updateScoreLabels() {
    if (destroyed) return;
    scoreLabel.textContent = String(score);
    scoreLabelDesktop.textContent = String(score);
  }

  function updateTimeLabels() {
    if (destroyed) return;
    const txt = formatTime(timeLeft);
    timeLabel.textContent = txt;
    timeLabelDesktop.textContent = txt;
  }

  function computeScoreFromIndex(idx) {
    if (idx <= -1) return 0;
    if (idx >= metaIndex) return CONFIG.pointsOnWin;
    const totalCells = path.length || 1;
    const progress = clamp((idx + 1) / totalCells, 0, 1);
    const rawScore = Math.round(progress * CONFIG.pointsOnWin);
    return Math.min(rawScore, CONFIG.pointsOnWin - 1);
  }

  function getVisibleHeight(el) {
    if (!el) return 0;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    return el.getBoundingClientRect().height;
  }

  function refreshChromeOffsets() {
    if (destroyed || !boardWrapEl) return;
    const wrapRect = boardWrapEl.getBoundingClientRect();
    const top = Math.max(0, wrapRect.top);
    const bottom = getVisibleHeight(bottomCtaEl);
    const totalTop = getVisibleHeight(topbarEl);
    const total = Math.max(0, Math.round(totalTop + bottom));
    boardWrapEl.style.setProperty("--chromeV", `${total}px`);
    const viewportHeight =
      (window.visualViewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight ?? 0);
    const available = Math.max(0, viewportHeight - bottom - top);
    if (available > 0) {
      const heightPx = `${available}px`;
      setFixedBlockHeight(boardWrapEl, heightPx);
      setFixedBlockHeight(sidePanelEl, heightPx);
      setFixedBlockHeight(layoutEl, heightPx);
    } else {
      clearFixedBlockHeight(boardWrapEl);
      clearFixedBlockHeight(sidePanelEl);
      clearFixedBlockHeight(layoutEl);
    }
    fitBoardSize();
  }

  function fitBoardSize() {
    if (destroyed || !boardWrapEl || !boardEl) return;
    const wrapRect = boardWrapEl.getBoundingClientRect();
    if (!wrapRect.width || !wrapRect.height) return;
    const styles = window.getComputedStyle(boardWrapEl);
    const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const availableWidth = Math.max(0, wrapRect.width - padX);
    const availableHeight = Math.max(0, wrapRect.height - padY);
    if (!availableWidth || !availableHeight) return;
    let width = availableHeight * boardAspect;
    let height = availableHeight;
    if (width > availableWidth) {
      width = availableWidth;
      height = width / boardAspect;
    }
    width = Math.max(width, 0);
    height = Math.max(height, 0);
    boardEl.style.width = `${width}px`;
    boardEl.style.height = `${height}px`;
  }

  function layoutCheck() {
    if (destroyed) return;
    const wasDesktop = isDesktop;
    isDesktop = window.innerWidth >= CONFIG.ui.desktopMinWidth;
    if (wasDesktop !== isDesktop) {
      // nada extra
    }
    refreshChromeOffsets();
  }

  function pxToPctX(px) { return px / design.width * 100; }
  function pxToPctY(px) { return px / design.height * 100; }

  function labelToPct(label) {
    const col = label[0];
    const row = label.slice(1);
    const x = design.colsPx[col];
    const y = design.rowsPx[row];
    return { xPct: pxToPctX(x), yPct: pxToPctY(y) };
  }

  function applyBoardBackground(url) {
    boardEl.style.backgroundImage = `url("${resolveAsset(url)}")`;
  }

  function setPieceToPct({ xPct, yPct }) {
    pieceEl.style.left = `${xPct}%`;
    pieceEl.style.top = `${yPct}%`;
  }

  function offsetPctFromPx(dyPx) { return pxToPctY(dyPx); }

  function buildPositions() {
    positions = path.map(labelToPct);
    const startPct = offsetPctFromPx(json.design.startOffsetPx);
    const goalPct = offsetPctFromPx(json.design.goalOffsetPx);
    startPos = { xPct: positions[0].xPct, yPct: positions[0].yPct + startPct };
    goalPos = { xPct: positions[lastIndex].xPct, yPct: positions[lastIndex].yPct - goalPct };
  }

  function getPosForIndex(i) {
    if (i < 0) return startPos;
    if (i === metaIndex) return goalPos;
    return positions[i];
  }

  function drawDebugGuides() {
    if (destroyed) return;
    const show = CONFIG.debug.showGuides;
    rootEl.classList.toggle("debug", !!show);
    if (!show) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = boardEl.getBoundingClientRect();
    debugCanvas.width = Math.round(rect.width * dpr);
    debugCanvas.height = Math.round(rect.height * dpr);
    debugCanvas.style.width = `${rect.width}px`;
    debugCanvas.style.height = `${rect.height}px`;

    const ctx = debugCanvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "rgba(255,176,0,.9)";
    positions.forEach((p, i) => {
      const x = rect.width * (p.xPct / 100);
      const y = rect.height * (p.yPct / 100);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "12px system-ui";
      ctx.fillText(String(i + 1), x + 8, y - 8);
      ctx.fillStyle = "rgba(255,176,0,.9)";
    });

    const sx = rect.width * (startPos.xPct / 100);
    const sy = rect.height * (startPos.yPct / 100);
    const gx = rect.width * (goalPos.xPct / 100);
    const gy = rect.height * (goalPos.yPct / 100);
    ctx.fillStyle = "rgba(0,200,255,.9)";
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(0,255,160,.9)";
    ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill();
  }

  // ------------------ Temporizador ------------------
  function startTimer() {
    stopTimer();
    timeLeft = CONFIG.timeLimitSec;
    timeExpired = false;
    updateTimeLabels();
    timerId = setInterval(() => {
      if (timeLeft <= 0) {
        stopTimer();
        onTimeExpired();
        return;
      }
      timeLeft--;
      updateTimeLabels();
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function onTimeExpired() {
    timeExpired = true;
    switch (state) {
      case State.ROLLING:
      case State.POST_ROLL_PAUSE:
        stopDiceAnim(true);
        endByTime();
        break;
      case State.MOVING_STEPS:
      case State.JUMPING:
        break;
      case State.CELL_PROMPT:
        closePrompt();
        endByTime();
        break;
      case State.IDLE:
        endByTime();
        break;
      default:
        break;
    }
  }

  // ------------------ Dado (frames + sacudida) ------------------
  function showDice(isPanel) {
    if (isPanel) {
      diceOverlay.classList.add("hidden");
    } else {
      diceOverlay.style.backgroundColor = `rgba(0,0,0,${CONFIG.dice.overlayOpacity})`;
      diceOverlay.classList.remove("hidden");
    }
  }
  function hideDice() {
    diceOverlay.classList.add("hidden");
  }

  function startShake(el, totalMs) {
    if (!el) return () => { };
    const { maxTranslatePx, maxRotateDeg, rampUp, rampDown } = CONFIG.dice.shake;
    let raf = null;
    let start = null;

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function tick(now) {
      if (!start) start = now;
      const elapsed = now - start;
      const t = clamp(elapsed / totalMs, 0, 1);

      let amp = 1;
      if (t < rampUp) amp = t / rampUp;
      else if (t > 1 - rampDown) amp = (1 - t) / rampDown;
      amp = easeInOut(amp);

      const tx = (rng() * 2 - 1) * maxTranslatePx * amp;
      const ty = (rng() * 2 - 1) * maxTranslatePx * amp;
      const rot = (rng() * 2 - 1) * maxRotateDeg * amp;
      el.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;

      if (t < 1) { raf = requestAnimationFrame(tick); }
      else { el.style.transform = ""; }
    }
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); el.style.transform = ""; };
  }

  function startDiceAnim(containerEl) {
    let current = Math.floor(rng() * DICE_FRAMES.length);
    const frameMs = CONFIG.dice.frameMs;
    const totalMs = Math.floor(lerp(CONFIG.dice.animMinMs, CONFIG.dice.animMaxMs, rng()));
    const endAt = performance.now() + totalMs;

    if (shakeStopFn) { try { shakeStopFn(); } catch { } }
    shakeStopFn = startShake(containerEl, totalMs);

    function setFrameByIndex(index) {
      const frame = DICE_FRAMES[index % DICE_FRAMES.length];
      diceImgOverlay.src = frame;
      diceImgPanel.src = frame;
    }

    setFrameByIndex(current);

    return new Promise(resolve => {
      diceAnimStopFn = () => {
        const result = 1 + Math.floor(rng() * 6);
        setFrameByIndex(result - 1);
        if (shakeStopFn) { try { shakeStopFn(); } catch { } shakeStopFn = null; }
        resolve(result);
      };
      diceAnimTimer = setInterval(() => {
        current = (current + 1 + Math.floor(rng() * 3)) % DICE_FRAMES.length;
        setFrameByIndex(current);
        if (performance.now() >= endAt) {
          clearInterval(diceAnimTimer); diceAnimTimer = null;
          const result = 1 + Math.floor(rng() * 6);
          setFrameByIndex(result - 1);
          diceAnimStopFn = null;
          if (shakeStopFn) { try { shakeStopFn(); } catch { } shakeStopFn = null; }
          resolve(result);
        }
      }, frameMs);
    });
  }

  function stopDiceAnim(forceNow = false) {
    if (forceNow && diceAnimStopFn) {
      const fn = diceAnimStopFn;
      diceAnimStopFn = null;
      fn();
    }
    if (diceAnimTimer) {
      clearInterval(diceAnimTimer);
      diceAnimTimer = null;
    }
    if (shakeStopFn) { try { shakeStopFn(); } catch { } shakeStopFn = null; }
  }

  function getDiceContainerEl() {
    if (isDesktop) return dicePanel;
    const box = document.querySelector("#diceOverlay .dice-box");
    return box || diceOverlay;
  }

  // ------------------ Movimiento ------------------
  async function moveSteps(steps) {
    setState(State.MOVING_STEPS);
    pieceEl.classList.add("moving");

    let target = currIndex + steps;
    if (!CONFIG.mustLandExact) {
      target = Math.min(target, metaIndex);
    } else {
      if (target > metaIndex) {
        if (CONFIG.exceedBehavior === "bounce") {
          const overshoot = target - metaIndex;
          target = metaIndex - overshoot;
        } else {
          target = currIndex;
        }
      }
    }

    while (currIndex < target) {
      const from = getPosForIndex(currIndex);
      const to = getPosForIndex(currIndex + 1);

      // SFX de arrastre en cada paso
      playDragSfx();

      await animatePiece(from, to, CONFIG.move.stepDurationMs);
      currIndex += 1;

      if (timeExpired && currIndex < target) {
        break;
      }
      await delay(CONFIG.move.pauseBetweenStepsMs);
    }

    pieceEl.classList.remove("moving");

    if (currIndex === metaIndex) {
      if (timeExpired) { endByTime(); } else { endByWin(); }
      return;
    }

    if (timeExpired) { endByTime(); return; }

    if (currIndex >= 0 && currIndex <= lastIndex) {
      openCellPrompt(currIndex);
    } else {
      setState(State.IDLE);
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function animatePiece(fromPct, toPct, durationMs) {
    return new Promise(resolve => {
      const easing = Easings[CONFIG.move.easing] || (t => t);
      const start = performance.now();

      const startX = fromPct.xPct, startY = fromPct.yPct;
      const endX = toPct.xPct, endY = toPct.yPct;

      function frame(t) {
        const dt = clamp((t - start) / durationMs, 0, 1);
        const e = easing(dt);
        const x = lerp(startX, endX, e);
        const y = lerp(startY, endY, e);
        setPieceToPct({ xPct: x, yPct: y });

        if (dt < 1) { requestAnimationFrame(frame); }
        else { resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  function animateJump(fromIdx, toIdx) {
    setState(State.JUMPING);
    pieceEl.classList.add("moving");
    const from = getPosForIndex(fromIdx);
    const to = getPosForIndex(toIdx);

    const dx = Math.abs(from.xPct - to.xPct);
    const dy = Math.abs(from.yPct - to.yPct);
    const dist = Math.hypot(dx, dy) / 100;
    const dur = Math.max(350, CONFIG.move.jumpBaseMs * (0.5 + dist));

    return animatePiece(from, to, dur).then(() => {
      pieceEl.classList.remove("moving");
      currIndex = toIdx;

      if (currIndex === metaIndex) {
        endByWin();
      } else if (timeExpired) {
        endByTime();
      } else {
        setState(State.IDLE);
      }
    });
  }

  // ------------------ Helpers de imagen ------------------
  function preloadImage(src, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
    const img = new Image();
      try { img.decoding = "async"; } catch { }
      const t = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, timeoutMs);
      function cleanup() { clearTimeout(t); img.onload = null; img.onerror = null; }
      img.onload = () => { cleanup(); resolve(src); };
      img.onerror = () => { cleanup(); reject(new Error("error")); };
      img.src = resolveAsset(src);
    });
  }

  // ------------------ Prompts ------------------
  async function openCellPrompt(idx) {
    if (destroyed) return;
    setState(State.CELL_PROMPT);
    const c = cells[idx];
    const imgPath = resolveAsset(`img/casillas/${c.image}`);

    const myToken = ++promptToken;

    // mantener oculto mientras cargamos
    promptModal.classList.add("hidden");
    promptModal.setAttribute("aria-hidden", "true");

    try {
      await preloadImage(imgPath);
      if (myToken !== promptToken) return;
      promptImage.src = imgPath;
    } catch {
      if (myToken !== promptToken) return;
      promptImage.removeAttribute("src");
    }

    if (timeExpired) { endByTime(); return; }
    if (myToken !== promptToken) return;

    promptTitle.textContent = c.title || "";
    promptText.textContent = c.text || "";

    promptModal.classList.remove("hidden");
    promptModal.setAttribute("aria-hidden", "false");

    function onAccept() {
      if (myToken === promptToken) promptToken++;
      closePrompt();

      const type = c.type || "none";
      if ((type === "ladder" || type === "snake") && !timeExpired) {
        const to = clamp((c.jumpTo | 0) - 1, 0, lastIndex);
        animateJump(idx, to);
      } else {
        setState(State.IDLE);
      }
    }

    promptAccept.onclick = onAccept;
    promptClose.onclick = () => {
      if (myToken === promptToken) promptToken++;
      closePrompt();
      if (timeExpired) endByTime(); else setState(State.IDLE);
    };
  }

  function closePrompt() {
    promptModal.classList.add("hidden");
    promptModal.setAttribute("aria-hidden", "true");
    promptAccept.onclick = null;
    promptClose.onclick = null;
  }

  function openSystemPrompt(title, text, btnLabel = "Entendido", options = {}) {
    if (destroyed) return Promise.resolve();
    systemTitle.textContent = title;
    systemText.textContent = text;
    systemModal.classList.remove("hidden");
    systemModal.setAttribute("aria-hidden", "false");
    const btn = systemAccept;
    btn.textContent = btnLabel;
    return new Promise(resolve => {
      btn.onclick = async () => {
        if (options?.onAccept) {
          try {
            const res = await options.onAccept(btn);
            if (res === false) return;
          } catch (err) {
            console.error("[Escaleras] onAccept error:", err);
            return;
          }
        }
        closeSystemPrompt();
        resolve();
      };
    });
  }
  function closeSystemPrompt() {
    systemModal.classList.add("hidden");
    systemModal.setAttribute("aria-hidden", "true");
    systemAccept.onclick = null;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]
    ));
  }

  // ------------------ Finales ------------------
  function endByWin() {
    setState(State.END_WIN);
    stopTimer();
    score = CONFIG.pointsOnWin;
    updateScoreLabels();

    emitGameFinished({
      gameId: GAME_ID,
      result: "win",
      score,
      timeLeft: Math.max(0, Number(timeLeft || 0)),
      finishedAt: Date.now()
    });

    const s = json.strings;
    const msg = `${s.winText}\n\nPuntaje: ${score} pts`;
    openSystemPrompt(s.winTitle, msg, s.btnAccept, {
      onAccept: btn => handleFinalAccept("win", btn)
    });
  }

  function endByTime() {
    setState(State.END_TIMEUP);
    stopTimer();
    score = computeScoreFromIndex(currIndex);
    updateScoreLabels();

    emitGameFinished({
      gameId: GAME_ID,
      result: "timeup",
      score,
      timeLeft: Math.max(0, Number(timeLeft || 0)),
      finishedAt: Date.now()
    });

    const s = json.strings;
    const msg = `${s.loseText}\n\nPuntaje: ${score} pts`;
    openSystemPrompt(s.loseTitle, msg, s.btnAccept, {
      onAccept: btn => handleFinalAccept("timeup", btn)
    });
  }

  // ------------------ Interacciones ------------------
  async function onRollClick() {
    if (state !== State.IDLE || timeExpired) return;

    // Asegurar BGM (por si el navegador bloqueó el autoplay en la intro)
    await ensureAudioPlaying();

    // SFX del dado (una vez por tirada)
    playDiceSfx();

    // Mostrar dado donde corresponde
    showDice(isDesktop);
    const containerEl = getDiceContainerEl();

    setState(State.ROLLING);
    const roll = await startDiceAnim(containerEl);

    if (timeExpired) { hideDice(); endByTime(); return; }

    setState(State.POST_ROLL_PAUSE);
    await delay(CONFIG.dice.postRollPauseMs);

    hideDice();
    if (timeExpired) { endByTime(); return; }

    await moveSteps(roll);

    score = computeScoreFromIndex(currIndex);
    updateScoreLabels();
  }

  if (rollBtn) {
    rollBtn.addEventListener("click", onRollClick);
    cleanupFns.push(() => rollBtn.removeEventListener("click", onRollClick));
  }
  if (rollBtnDesk) {
    rollBtnDesk.addEventListener("click", onRollClick);
    cleanupFns.push(() => rollBtnDesk.removeEventListener("click", onRollClick));
  }

  // ------------------ Inicialización ------------------
  async function loadJSON() {
    const res = await fetch(JSON_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar board_eco.json");
    json = await res.json();
  }

  function mapJSON() {
    design = json.design;
    path = json.path.slice();
    lastIndex = path.length - 1;
    metaIndex = lastIndex + 1;
    if (design?.width && design?.height) {
      boardAspect = design.width / design.height;
    }

    const byLabel = new Map(path.map((lab, i) => [lab, i]));
    cells = new Array(path.length);
    for (const c of json.cells) {
      const idx0 = (c.id | 0) - 1;
      const label = c.label;
      const p = byLabel.get(label);
      if (p == null || p !== idx0) {
        // priorizamos id
      }
      cells[idx0] = {
        id: idx0 + 1,
        label: label,
        title: c.title || "",
        text: c.text || "",
        image: c.image,
        type: c.type || "none",
        jumpTo: c.jumpTo || null
      };
    }

    buildPositions();
    applyBoardBackground(json.boardImage); // recuerda: tu JPG

    setPieceToPct(startPos);
    fitBoardSize();

    if (CONFIG.debug.showGuides) drawDebugGuides();

    layoutCheck();
    const onResize = () => {
      layoutCheck();
      if (CONFIG.debug.showGuides) drawDebugGuides();
    };
    window.addEventListener("resize", onResize);
    cleanupFns.push(() => window.removeEventListener("resize", onResize));

    if (window.visualViewport) {
      const onViewport = () => {
        refreshChromeOffsets();
        if (CONFIG.debug.showGuides) drawDebugGuides();
      };
      window.visualViewport.addEventListener("resize", onViewport);
      window.visualViewport.addEventListener("scroll", onViewport);
      cleanupFns.push(() => {
        try { window.visualViewport.removeEventListener("resize", onViewport); } catch {}
        try { window.visualViewport.removeEventListener("scroll", onViewport); } catch {}
      });
    }

    // preparar BGM y enganchar VolumeSystem
    initBgm();
    hookVolumeSystem();

    const s = json.strings;
    setState(State.INTRO);
    openSystemPrompt(s.introTitle, s.introText, s.btnAccept).then(async () => {
      setState(State.IDLE);
      startTimer();
      if (rollBtn) rollBtn.textContent = s.rollButton || "Tirar el dado";

      // Intento de BGM justo tras gesto del usuario (click en “Entendido”)
      await ensureAudioPlaying();

      updateScoreLabels();
      updateTimeLabels();
    });
  }

  // GO
  layoutCheck();
  loadJSON()
    .then(() => {
      if (destroyed) return;
      mapJSON();
    })
    .catch(err => {
      if (destroyed) return;
      console.error(err);
      openSystemPrompt("Error", "No se pudo cargar el tablero. Revisa la consola.", "Ok");
    });

  function cleanup() {
    if (destroyed) return;
    destroyed = true;

    try { stopDiceAnim(true); } catch {}
    try { stopTimer(); } catch {}
    hideDice();

    if (bgm) {
      try { bgm.pause(); } catch {}
      try { bgm.removeAttribute?.("src"); } catch {}
      bgm = null;
    }
    activeSfx.forEach(a => {
      try { a.pause(); } catch {}
      try { a.remove?.(); } catch {}
    });
    activeSfx.clear();

    cleanupFns.splice(0).forEach(fn => {
      try { fn?.(); } catch {}
    });

    promptAccept.onclick = null;
    promptClose.onclick = null;
    systemAccept.onclick = null;

    promptModal.classList.add("hidden");
    promptModal.setAttribute("aria-hidden", "true");
    systemModal.classList.add("hidden");
    systemModal.setAttribute("aria-hidden", "true");
    rootEl.classList.remove("debug");
    try { boardWrapEl?.style.removeProperty("--chromeV"); } catch {}
    clearFixedBlockHeight(boardWrapEl);
    clearFixedBlockHeight(sidePanelEl);
    clearFixedBlockHeight(layoutEl);
    try { boardEl.style.width = ""; boardEl.style.height = ""; } catch {}
  }

  return cleanup;
}
