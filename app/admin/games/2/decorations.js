// decorations.js — decor scattering engine (Next.js module)

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = (t ^ t >>> 15) * (t | 1);
    t ^= t + (t ^ t >>> 7) * (t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const imgCache = new Map();
async function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((resolve) => {
    const im = new Image();
    try { im.decoding = 'async'; } catch (_) {}
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
  imgCache.set(src, p);
  return p;
}

function fitByMax(img, maxPx) {
  const iw = img.width || 64;
  const ih = img.height || 64;
  const k = maxPx / Math.max(iw, ih);
  return { w: iw * k, h: ih * k };
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function weightCenterAvoid(xNorm, yNorm, params) {
  const axis = params.axis || 'both';
  const radius = params.radius ?? 0.3;
  const strength = params.strength ?? 0.7;
  const gamma = 1 + strength * 3;
  let d;
  if (axis === 'x') {
    d = Math.abs(xNorm - 0.5) / 0.5;
  } else if (axis === 'y') {
    d = Math.abs(yNorm - 0.5) / 0.5;
  } else {
    const dx = Math.abs(xNorm - 0.5) / 0.5;
    const dy = Math.abs(yNorm - 0.5) / 0.5;
    d = Math.min(dx, dy);
  }
  const w = smoothstep(radius, 1, d);
  return Math.pow(w, gamma);
}

const weightUniform = () => 1;

function biasWeight(xNorm, yNorm, cfg) {
  if (!cfg || cfg.type === 'uniform') return weightUniform();
  if (cfg.type === 'centerAvoid' || cfg.type === 'edgeBias') return weightCenterAvoid(xNorm, yNorm, cfg);
  return 1;
}

function pathJoinBase(s) {
  if (/^(\.\/|\/|https?:)/.test(s)) return s;
  return `/games/2/assets/decor/${s}`;
}

function pathJoinTheme(folder, s) {
  if (/^(\.\/|\/|https?:)/.test(s)) return s;
  return `/games/2/assets/decor/${folder}/${s}`;
}

function expandAssetsRange(base, from, to, ext = '.png', pad = 2) {
  const out = [];
  for (let i = from; i <= to; i++) {
    out.push(`${base}${String(i).padStart(pad, '0')}${ext}`);
  }
  return out;
}

export const Deco = {
  _inited: false,
  _canvas: null,
  _ctx: null,
  _cfg: null,
  _layers: [],
  _drawBuckets: null,
  _postfx: null,
  _rng: null,
  _seedStr: '',
  _themeFolders: null,
  _getScenario: null,
  _getGrid: null,
  _getTrackMask: null,
  _getErrorTier: null,
  _hasAnimatedLayers: false,

  async init(opts) {
    if (this._inited) return;
    this._canvas = opts.canvas;
    this._ctx = this._canvas.getContext('2d');
    this._getScenario = opts.getScenario;
    this._getGrid = opts.getGrid;
    this._getTrackMask = opts.getTrackMask;
    this._getErrorTier = opts.getErrorTier;

    const jsonPath = opts.jsonPath || '/games/2/jsons/decorations.json';
    this._cfg = { layers: [], postfx: {}, theme: { tierMap: ['01_green', '02_pale_green', '03_orange', '04_brown'] } };
    this._themeFolders = this._cfg.theme.tierMap.slice();

    try {
      const cfg = await (await fetch(jsonPath, { cache: 'no-cache' })).json();
      this._cfg = cfg || this._cfg;
      this._themeFolders = (this._cfg.theme && Array.isArray(this._cfg.theme.tierMap))
        ? this._cfg.theme.tierMap
        : ['01_green', '02_pale_green', '03_orange', '04_brown'];
    } catch (e) {
      // mantiene defaults
    }

    this._drawBuckets = { belowTracks: [], aboveTracks: [], aboveTrain: [] };
    this._hasAnimatedLayers = false;
    this._inited = true;
  },

  _activeTheme() {
    const tier = (this._getErrorTier && this._getErrorTier()) || 0;
    const idx = Math.max(0, Math.min(3, tier));
    const tf = (this._themeFolders && this._themeFolders.length)
      ? this._themeFolders
      : ['01_green', '02_pale_green', '03_orange', '04_brown'];
    return tf[idx] || tf[0];
  },

  async rebuild(seedStr) {
    if (!this._inited) return;
    this._seedStr = seedStr || 'seed';
    this._rng = mulberry32(strHash(this._seedStr));

    const W = this._canvas.width;
    const H = this._canvas.height;
    const trackRects = (this._getTrackMask && this._getTrackMask()) || [];
    this._layers = [];
    this._drawBuckets = { belowTracks: [], aboveTracks: [], aboveTrain: [] };
    this._hasAnimatedLayers = false;

    for (const L of (this._cfg.layers || [])) {
      const layer = {
        id: L.id,
        z: L.z ?? 0,
        drawWhere: L.drawWhere || 'belowTracks',
        density: L.densityPer100kPx || 0,
        scaleRange: L.scaleRange || [1, 1],
        rotationRange: L.rotationRange || [0, 0],
        size: L.size || { mode: 'tile', tileFactor: 1 },
        pixelScale: L.pixelScale || 1,
        animate: L.animate || null,
        distribution: L.distribution || { mask: 'none', bias: { type: 'uniform' } },
        avoidRadius: L.distribution?.avoidTracksRadiusPx || 0,
        theme: !!L.theme,
        assetsFolder: L.assetsFolder || null,
        opacityRange: L.opacityRange || null,
        shadow: L.shadow || null,
        items: []
      };

      let names = [];
      if (L.assetsRange) names = expandAssetsRange(L.assetsRange.base, L.assetsRange.from, L.assetsRange.to, L.assetsRange.ext, L.assetsRange.pad);
      else if (Array.isArray(L.assets)) names = L.assets.slice();
      const folder = L.theme ? this._activeTheme() : L.assetsFolder;
      const paths = names.map((n) =>
        L.theme
          ? pathJoinTheme(folder, n)
          : (L.assetsFolder ? pathJoinTheme(L.assetsFolder, n) : pathJoinBase(n))
      );
      const imgs = (await Promise.all(paths.map(loadImage))).filter(Boolean);
      const choices = imgs.map((img) => ({ type: 'single', imgs: [img] }));

      const density = Math.max(0, layer.density);
      const area = W * H;
      const targetCount = Math.floor((area / 100000) * density);
      const items = [];
      const ts = (this._getGrid?.().tileSize) || 96;
      const maxAttempts = Math.max(50, targetCount * 8);
      let attempts = 0;

      while (items.length < targetCount && attempts < maxAttempts) {
        attempts++;
        const xNorm = this._rng();
        const yNorm = this._rng();
        const x = xNorm * W;
        const y = yNorm * H;

        const weight = biasWeight(xNorm, yNorm, layer.distribution?.bias);
        if (this._rng() > weight) continue;

        if (layer.distribution?.mask === 'avoidTracks') {
          const r = layer.distribution?.avoidTracksRadiusPx || 0;
          let blocked = false;
          for (const rect of trackRects) {
            if (x >= rect.x - r && x <= rect.x + rect.w + r && y >= rect.y - r && y <= rect.y + rect.h + r) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;
        }

        const choice = choices.length ? choices[Math.floor(this._rng() * choices.length)] : null;
        if (!choice) continue;
        const baseImg = choice.imgs[0];
        if (!baseImg) continue;

        const rot = (layer.rotationRange[0] + this._rng() * (layer.rotationRange[1] - layer.rotationRange[0])) * Math.PI / 180;
        const sc = lerp(layer.scaleRange[0], layer.scaleRange[1], this._rng()) * (layer.pixelScale || 1);
        const alpha = layer.opacityRange ? lerp(layer.opacityRange[0], layer.opacityRange[1], this._rng()) : 1;

        let drawW = 0;
        let drawH = 0;
        if (layer.size?.mode === 'tile') {
          const maxPx = ts * (layer.size.tileFactor ?? 1) * sc;
          const fit = fitByMax(baseImg, Math.max(4, maxPx));
          drawW = fit.w; drawH = fit.h;
        } else if (layer.size?.mode === 'pixel') {
          const maxPx = (layer.size.maxPx ?? 64) * sc;
          const fit = fitByMax(baseImg, Math.max(4, maxPx));
          drawW = fit.w; drawH = fit.h;
        } else {
          const fit = fitByMax(baseImg, ts * sc);
          drawW = fit.w; drawH = fit.h;
        }

        const item = {
          x,
          y,
          baseX: x,
          baseY: y,
          rot,
          scale: sc,
          alpha,
          img: baseImg,
          frames: null,
          frameAnim: null,
          wobble: null,
          _w: drawW,
          _h: drawH
        };

        if (layer.animate?.type === 'wobble') {
          const [axMin, axMax] = layer.animate.ampPxRange || [1, 3];
          const [spMin, spMax] = layer.animate.speedRange || [0.2, 0.6];
          item.wobble = {
            ampX: randRange(this._rng, axMin, axMax),
            ampY: randRange(this._rng, axMin, axMax),
            speed: randRange(this._rng, spMin, spMax),
            phase: this._rng() * Math.PI * 2
          };
        } else if (layer.animate?.type === 'frames') {
          const frames = choice.imgs;
          if (frames?.length) {
            const fpsMin = layer.animate.fpsRange?.[0] ?? 1;
            const fpsMax = layer.animate.fpsRange?.[1] ?? 2;
            item.frames = frames;
            item.frameAnim = {
              fps: randRange(this._rng, fpsMin, fpsMax),
              t: 0,
              idx: layer.animate.startFrameRandom ? Math.floor(this._rng() * frames.length) : 0
            };
          }
        }

        items.push(item);
      }

      layer.items = items;
      this._layers.push(layer);
      const bucketKey = layer.drawWhere || 'belowTracks';
      if (!this._drawBuckets[bucketKey]) this._drawBuckets[bucketKey] = [];
      this._drawBuckets[bucketKey].push(layer);
      if (layer.animate?.type && layer.items.length) this._hasAnimatedLayers = true;
    }

    for (const key of Object.keys(this._drawBuckets)) {
      this._drawBuckets[key].sort((a, b) => (a.z || 0) - (b.z || 0));
    }

    const pf = this._cfg.postfx || {};
    this._postfx = { vignette: null, godrays: null };

      if (pf.godrays?.enabled) {
        const gr = {
          images: [],
          count: pf.godrays.count ?? 0,
          tilt: (pf.godrays.tiltDeg || 0) * Math.PI / 180,
          tileVertical: !!pf.godrays.tileVertical,
          scaleRange: pf.godrays.scaleRange || [1, 1],
          swayAmp: pf.godrays.sway?.ampPx ?? 20,
          swaySpeedRange: pf.godrays.sway?.speedRange || [0.05, 0.1],
          opacityMin: pf.godrays.opacity?.min ?? 0.15,
          opacityMax: pf.godrays.opacity?.max ?? 0.35,
          opacitySpeedRange: pf.godrays.opacity?.speedRange || [0.05, 0.1],
          composite: pf.godrays.blend || pf.godrays.composite || 'lighter',
          instances: []
        };

      if (Array.isArray(pf.godrays.images) && pf.godrays.images.length) {
        const imgs = await Promise.all(pf.godrays.images.map((s) => loadImage(pathJoinBase(s))));
        gr.images = imgs.filter(Boolean);
      }

      if (gr.images.length) {
        for (let i = 0; i < gr.count; i++) {
          const im = gr.images.length ? gr.images[Math.floor(this._rng() * gr.images.length)] : null;
          if (!im) continue;
          gr.instances.push({
            img: im,
            baseX: this._rng() * this._canvas.width,
            scale: lerp(gr.scaleRange[0], gr.scaleRange[1], this._rng()),
            swaySpeed: randRange(this._rng, gr.swaySpeedRange[0], gr.swaySpeedRange[1]),
            opacitySpeed: randRange(this._rng, gr.opacitySpeedRange[0], gr.opacitySpeedRange[1]),
            phase: this._rng() * Math.PI * 2
          });
        }
      }

      this._postfx.godrays = gr;
    }

    if (pf.vignette?.enabled) {
      this._postfx.vignette = {
        inner: pf.vignette.inner ?? 0.55,
        outer: pf.vignette.outer ?? 1.0,
        opacity: pf.vignette.opacity ?? 0.42,
        color: pf.vignette.color || '#000000'
      };
    }
  },

  update(dt) {
    if (!this._hasAnimatedLayers) return;
    for (const L of this._layers) {
      if (!L.items?.length) continue;
      if (L.animate?.type === 'wobble') {
        for (const it of L.items) {
          if (!it.wobble) continue;
          const w = it.wobble;
          const t = performance.now() / 1000;
          it.x = it.baseX + Math.sin(t * w.speed + w.phase) * w.ampX;
          it.y = it.baseY + Math.cos(t * w.speed * 0.9 + w.phase * 1.37) * w.ampY;
        }
      } else if (L.animate?.type === 'frames') {
        for (const it of L.items) {
          if (!it.frameAnim || !it.frames) continue;
          it.frameAnim.t += dt;
          const step = 1 / (it.frameAnim.fps || 1);
          while (it.frameAnim.t >= step) {
            it.frameAnim.t -= step;
            it.frameAnim.idx = (it.frameAnim.idx + 1) % it.frames.length;
          }
        }
      }
    }
  },

  hasAnimatedContent() {
    return this._hasAnimatedLayers || !!(this._postfx?.godrays?.instances?.length);
  },

  draw(ctx, where, opts = {}) {
    const list = this._drawBuckets?.[where] || [];

    const clipMode = opts.clip || null;
    const rect = opts.rect || null;
    const T = opts.transform || null;

    for (const L of list) {
      const shadow = L.shadow;
      if (shadow?.enabled) {
        ctx.shadowColor = `rgba(0,0,0,${clamp(shadow.opacity ?? 0.2, 0, 1)})`;
        ctx.shadowBlur = shadow.blurPx ?? 6;
        ctx.shadowOffsetX = shadow.offsetX ?? 6;
        ctx.shadowOffsetY = shadow.offsetY ?? 8;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.save();
      if (T) {
        ctx.scale(T.sx ?? 1, T.sy ?? 1);
        ctx.translate(T.tx ?? 0, T.ty ?? 0);
      }

      for (const it of L.items) {
        const x = it.x;
        const y = it.y;
        if (clipMode && rect) {
          const inside = (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
          if (clipMode === 'inside' && !inside) continue;
          if (clipMode === 'outside' && inside) continue;
        }

        const img = it.frames ? it.frames[it.frameAnim?.idx ?? 0] : it.img;
        if (!img) continue;

        const sw = it._w && it._w > 0 ? it._w : img.width * (it.scale || 1);
        const sh = it._h && it._h > 0 ? it._h : img.height * (it.scale || 1);

        ctx.globalAlpha = clamp(it.alpha ?? 1, 0, 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(it.rot || 0);
        ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  },

  drawPost(ctx) {
    const vg = this._postfx?.vignette;
    if (vg) {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const inner = vg.inner ?? 0.55;
      const outer = vg.outer ?? 1.0;
      const op = clamp(vg.opacity ?? 0.42, 0, 1);
      const color = vg.color || '#000000';
      const hex = color.replace('#', '');
      const v = parseInt(hex, 16);
      const r = (v >> 16) & 255;
      const g = (v >> 8) & 255;
      const b = v & 255;

      ctx.save();
      ctx.translate(W / 2, H / 2);
      const sy = H / W;
      ctx.scale(1, sy);
      const rIn = inner * (W / 2);
      const rOut = outer * (W / 2);
      const grad = ctx.createRadialGradient(0, 0, rIn, 0, 0, rOut);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${op})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-W / 2, -H / (2 * sy), W, H / sy);
      ctx.restore();
    }

    const gr = this._postfx?.godrays;
    if (gr) {
        const ctx2 = ctx;
        const W = ctx2.canvas.width;
        const H = ctx2.canvas.height;
        const prevComp = ctx2.globalCompositeOperation;
        ctx2.save();
        ctx2.globalCompositeOperation = gr.composite || 'lighter';

        const span = Math.hypot(W, H) + 200;

        for (const ins of gr.instances) {
          const t = performance.now() / 1000;
          const sway = Math.sin(t * ins.swaySpeed + ins.phase) * (gr.swayAmp || 20);
          const opMin = gr.opacityMin ?? 0.05;
          const opMax = gr.opacityMax ?? 0.35;
          const op = opMin + (Math.sin(t * ins.opacitySpeed + ins.phase * 1.33) * 0.5 + 0.5) * (opMax - opMin);

          const sw = ins.img.width * ins.scale;
          const sh = ins.img.height * ins.scale;
          const x = ins.baseX + sway;

          ctx2.save();
          ctx2.globalAlpha = clamp(op, 0, 1);
          ctx2.translate(x, 0);
          if (gr.tilt) ctx2.rotate(gr.tilt);

          if (gr.tileVertical) {
            const total = span + sh * 2;
            const n = Math.ceil(total / sh) + 2;
            let y = -total / 2;
            for (let i = 0; i < n; i++) {
              ctx2.drawImage(ins.img, -sw / 2, y + i * sh, sw, sh);
            }
          } else {
            ctx2.drawImage(ins.img, -sw / 2, -sh / 2, sw, sh);
          }

          ctx2.restore();
        }

        ctx2.restore();
        ctx2.globalCompositeOperation = prevComp;
        ctx2.globalAlpha = 1;
      }
    }
  };
