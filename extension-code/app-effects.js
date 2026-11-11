// Name: App Effects
// ID: appeffects
// Description: Confetti, fireworks, falling effects, floating text, ripples, screen motion, filters, overlays and fades.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Effects must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;
  const runtime = Scratch.vm.runtime;
  const BT = Scratch.BlockType;
  const AT = Scratch.ArgumentType;
  const EXT_ID = 'appeffects';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const parseList = (v) => {
    const s = Cast.toString(v).trim();
    if (s.startsWith('[')) {
      try {
        const a = JSON.parse(s);
        if (Array.isArray(a)) return a.map(String);
      } catch (e) {}
    }
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  };

  const safeColor = (c, fallback) => {
    const s = Cast.toString(c).trim();
    try {
      if (window.CSS && CSS.supports('color', s)) return s;
    } catch (e) {}
    return fallback === undefined ? '#8b5cf6' : fallback;
  };

  const toHex = (rgb) =>
    '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  const parseHex = (c) => {
    let s = Cast.toString(c).trim().replace('#', '');
    if (s.length === 3) {
      s = s
        .split('')
        .map((x) => x + x)
        .join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };

  let colorCtx = null;

  const colorToHex = (c) => {
    try {
      colorCtx = colorCtx || document.createElement('canvas').getContext('2d');
      colorCtx.fillStyle = '#000000';
      colorCtx.fillStyle = Cast.toString(c).trim();
      const v = colorCtx.fillStyle;
      if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
      const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (m) return toHex([Number(m[1]), Number(m[2]), Number(m[3])]);
    } catch (e) {}
    return null;
  };

  const rgba = (c, a) => {
    const rgb = parseHex(colorToHex(c) || '');
    return rgb ? `rgba(${rgb.join(',')},${a})` : `rgba(0,0,0,${a})`;
  };

  const getContainer = () => {
    const canvas = runtime.renderer && runtime.renderer.canvas;
    const el = canvas && canvas.parentElement;
    if (!el) return document.body;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return el;
  };

  const positionMode = (container) => (container === document.body ? 'fixed' : 'absolute');

  const layers = new Set();
  const overlays = new Map();
  const anims = new Set();
  const filterTweens = new Map();
  let falling = null;
  let tweenSeq = 0;

  const removeLayer = (el) => {
    layers.delete(el);
    el.remove();
  };

  const makeCanvas = (z) => {
    const container = getContainer();
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    Object.assign(canvas.style, {
      position: positionMode(container),
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(z)
    });
    container.appendChild(canvas);
    layers.add(canvas);
    return { canvas, ctx: canvas.getContext('2d'), w, h };
  };

  const runLoop = (layer, step, maxMs) => {
    const started = Date.now();
    const frame = () => {
      if (!layer.canvas.isConnected) return;
      const elapsed = Date.now() - started;
      const done = step(layer.ctx, layer.w, layer.h, elapsed);
      if (done || elapsed > maxMs) removeLayer(layer.canvas);
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  const DEFAULT_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#eab308'];
  const colorList = (colors) => (colors.length ? colors : DEFAULT_COLORS);

  const confetti = (count, xPct, yPct, colors) => {
    const L = makeCanvas(100003);
    const cols = colorList(colors);
    const ox = (clamp(xPct, 0, 100) / 100) * L.w;
    const oy = (clamp(yPct, 0, 100) / 100) * L.h;
    const parts = Array.from({ length: count }, (_, i) => {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(4, 14);
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: rand(4, 10),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.2, 0.2),
        color: cols[i % cols.length]
      };
    });
    runLoop(
      L,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        let alive = 0;
        parts.forEach((p) => {
          p.vy += 0.35;
          p.vx *= 0.992;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          if (p.y < h + 20) {
            alive++;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            ctx.restore();
          }
        });
        return alive === 0;
      },
      7000
    );
  };

  const fireworks = (count, colors) => {
    const L = makeCanvas(100003);
    const cols = colorList(colors);
    const RISE = 750;
    const rockets = Array.from({ length: count }, (_, i) => ({
      launchAt: i * 380 + rand(0, 220),
      x: rand(0.15, 0.85) * L.w,
      topY: rand(0.12, 0.45) * L.h,
      color: pick(cols),
      exploded: false
    }));
    const sparks = [];
    runLoop(
      L,
      (ctx, w, h, t) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        rockets.forEach((r) => {
          if (r.exploded || t < r.launchAt) return;
          const p = Math.min(1, (t - r.launchAt) / RISE);
          const y = h - (h - r.topY) * (1 - Math.pow(1 - p, 2));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(r.x - 1.5, y, 3, 8);
          if (p >= 1) {
            r.exploded = true;
            const n = 70;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              const s = rand(1.5, 6);
              sparks.push({
                x: r.x,
                y: r.topY,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 1,
                decay: rand(0.012, 0.024),
                color: r.color
              });
            }
          }
        });
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.vy += 0.05;
          s.vx *= 0.985;
          s.vy *= 0.985;
          s.x += s.vx;
          s.y += s.vy;
          s.life -= s.decay;
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = s.life;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return rockets.every((r) => r.exploded) && sparks.length === 0;
      },
      15000
    );
  };

  const emojiBurst = (glyphs, count, xPct, yPct) => {
    const L = makeCanvas(100003);
    const ox = (clamp(xPct, 0, 100) / 100) * L.w;
    const oy = (clamp(yPct, 0, 100) / 100) * L.h;
    const parts = Array.from({ length: count }, () => {
      const a = rand(0, Math.PI * 2);
      const s = rand(2, 9);
      return {
        x: ox,
        y: oy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 3,
        size: rand(16, 34),
        rot: rand(-0.5, 0.5),
        vr: rand(-0.1, 0.1),
        life: 1,
        decay: rand(0.008, 0.018),
        glyph: pick(glyphs)
      };
    });
    runLoop(
      L,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let alive = 0;
        parts.forEach((p) => {
          p.vy += 0.18;
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          p.life -= p.decay;
          if (p.life > 0) {
            alive++;
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life * 1.5);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.font = `${p.size}px serif`;
            ctx.fillText(p.glyph, 0, 0);
            ctx.restore();
          }
        });
        return alive === 0;
      },
      6000
    );
  };

  const FALL_KINDS = {
    snow: { shape: 'dot', color: '#ffffff', size: [2, 5], vy: [0.6, 1.8], sway: 0.6 },
    rain: { shape: 'line', color: 'rgba(160,200,255,0.8)', size: [10, 18], vy: [11, 17], vx: -1.5 },
    leaves: { glyph: '🍃', size: [14, 22], vy: [0.8, 1.8], sway: 1.2, spin: 0.05 },
    stars: { glyph: '⭐', size: [10, 20], vy: [1, 2.6], sway: 0.4, spin: 0.04 },
    hearts: { glyph: '❤️', size: [14, 26], vy: [-1.5, -0.6], sway: 0.8 },
    bubbles: { shape: 'ring', color: 'rgba(190,232,255,0.9)', size: [6, 18], vy: [-1.6, -0.5], sway: 0.8 },
    embers: { shape: 'glow', color: '#ff8a3d', size: [2, 4], vy: [-2.2, -0.7], sway: 0.9 }
  };

  const drawFalling = (ctx, p, cfg) => {
    if (cfg.glyph) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.size}px serif`;
      ctx.fillText(cfg.glyph, 0, 0);
      ctx.restore();
    } else if (cfg.shape === 'line') {
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (cfg.vx || 0) * 1.2, p.y + p.size);
      ctx.stroke();
    } else if (cfg.shape === 'ring') {
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (cfg.shape === 'glow') {
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const stopFalling = () => {
    if (falling) removeLayer(falling);
    falling = null;
  };

  const startFalling = (kind, secs, density) => {
    stopFalling();
    const cfg = FALL_KINDS[kind] || FALL_KINDS.snow;
    const L = makeCanvas(100002);
    falling = L.canvas;
    const parts = [];
    const rising = cfg.vy[1] < 0;
    const limit = secs > 0 ? secs * 1000 : Infinity;
    let last = 0;
    let acc = 0;
    runLoop(
      L,
      (ctx, w, h, t) => {
        const dt = last ? t - last : 16;
        last = t;
        if (t < limit && parts.length < 800) {
          acc += (density * dt) / 1000;
          while (acc >= 1) {
            acc -= 1;
            parts.push({
              x: rand(0, w + (cfg.vx ? 120 : 0)),
              y: rising ? h + 20 : -20,
              vy: rand(cfg.vy[0], cfg.vy[1]),
              size: rand(cfg.size[0], cfg.size[1]),
              phase: rand(0, Math.PI * 2),
              rot: rand(0, Math.PI * 2)
            });
          }
        }
        ctx.clearRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.phase += 0.03;
          p.x += (cfg.vx || 0) + Math.sin(p.phase) * (cfg.sway || 0);
          p.y += p.vy;
          p.rot += cfg.spin || 0;
          if (rising ? p.y < -30 : p.y > h + 30) {
            parts.splice(i, 1);
            continue;
          }
          drawFalling(ctx, p, cfg);
        }
        if (t >= limit && parts.length === 0) {
          falling = null;
          return true;
        }
        return false;
      },
      limit === Infinity ? Infinity : limit + 20000
    );
  };

  const popText = (text, xPct, yPct, colorValue, size, ms, mode) => {
    const container = getContainer();
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: positionMode(container),
      left: `${clamp(xPct, 0, 100)}%`,
      top: `${clamp(yPct, 0, 100)}%`,
      transform: 'translate(-50%,-50%)',
      pointerEvents: 'none',
      zIndex: '100006',
      color: colorValue,
      fontSize: `${size}px`,
      fontWeight: '800',
      fontFamily: 'system-ui,sans-serif',
      textShadow: '0 2px 8px rgba(0,0,0,0.45)',
      whiteSpace: 'pre',
      textAlign: 'center'
    });
    container.appendChild(el);
    layers.add(el);
    const done = () => removeLayer(el);
    const base = 'translate(-50%,-50%)';
    const frames =
      mode === 'splash'
        ? [
            { opacity: 0, transform: `${base} scale(0.4)` },
            { opacity: 1, transform: `${base} scale(1.15)`, offset: 0.18 },
            { opacity: 1, transform: `${base} scale(1)`, offset: 0.3 },
            { opacity: 1, transform: `${base} scale(1)`, offset: 0.8 },
            { opacity: 0, transform: `${base} scale(1.1)` }
          ]
        : [
            { opacity: 0, transform: `${base} translateY(12px) scale(0.8)` },
            { opacity: 1, transform: `${base} translateY(-8px) scale(1.1)`, offset: 0.15 },
            { opacity: 1, transform: `${base} translateY(-30px)`, offset: 0.7 },
            { opacity: 0, transform: `${base} translateY(-70px)` }
          ];
    if (el.animate) {
      const a = el.animate(frames, { duration: ms, easing: 'ease-out' });
      a.onfinish = done;
    }
    setTimeout(done, ms + 200);
  };

  const ripple = (xPct, yPct, colorValue, size, ms) => {
    const container = getContainer();
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: positionMode(container),
        left: `${clamp(xPct, 0, 100)}%`,
        top: `${clamp(yPct, 0, 100)}%`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: '50%',
        border: `3px solid ${colorValue}`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: '100005',
        opacity: '0'
      });
      container.appendChild(el);
      layers.add(el);
      const done = () => removeLayer(el);
      if (el.animate) {
        const a = el.animate(
          [
            { transform: 'scale(0.05)', opacity: 0.9 },
            { transform: 'scale(1)', opacity: 0 }
          ],
          { duration: ms, delay: i * ms * 0.25, easing: 'ease-out', fill: 'both' }
        );
        a.onfinish = done;
      }
      setTimeout(done, ms * 1.25 + 200);
    }
  };

  const containerAnimate = (frames, options) => {
    const container = getContainer();
    if (!container.animate) return;
    const a = container.animate(frames, options);
    anims.add(a);
    a.onfinish = a.oncancel = () => anims.delete(a);
  };

  const flashScreen = (colorValue, ms) => {
    const container = getContainer();
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: positionMode(container),
      inset: '0',
      background: colorValue,
      pointerEvents: 'none',
      zIndex: '100004',
      opacity: '0.8'
    });
    container.appendChild(el);
    layers.add(el);
    if (el.animate) {
      const a = el.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
      a.onfinish = () => removeLayer(el);
    }
    setTimeout(() => removeLayer(el), ms + 100);
  };

  const shakeScreen = (px, ms) => {
    const frames = [{ transform: 'translate(0,0)' }];
    for (let i = 0; i < 12; i++) {
      frames.push({
        transform: `translate(${rand(-px, px).toFixed(1)}px,${rand(-px, px).toFixed(1)}px)`
      });
    }
    frames.push({ transform: 'translate(0,0)' });
    containerAnimate(frames, { duration: ms, easing: 'linear' });
  };

  const punchZoom = (percent, ms) => {
    containerAnimate(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${1 + percent / 100})`, offset: 0.3 },
        { transform: 'scale(1)' }
      ],
      { duration: ms, easing: 'ease-out' }
    );
  };

  const spinScreen = (deg, ms) => {
    containerAnimate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }], {
      duration: ms,
      easing: 'ease-in-out'
    });
  };

  const wobbleScreen = (ms) => {
    containerAnimate(
      [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(-1.6deg) scale(1.01)', offset: 0.2 },
        { transform: 'rotate(1.4deg) scale(1.01)', offset: 0.4 },
        { transform: 'rotate(-1deg) scale(1.005)', offset: 0.6 },
        { transform: 'rotate(0.6deg)', offset: 0.8 },
        { transform: 'rotate(0deg) scale(1)' }
      ],
      { duration: ms, easing: 'ease-in-out' }
    );
  };

  const glitchScreen = (ms) => {
    const frames = [{ transform: 'none', filter: 'none' }];
    for (let i = 0; i < 10; i++) {
      frames.push({
        transform: `translate(${rand(-14, 14).toFixed(1)}px,${rand(-4, 4).toFixed(1)}px) skewX(${rand(-8, 8).toFixed(1)}deg)`,
        filter: `hue-rotate(${Math.round(rand(-90, 90))}deg) saturate(${rand(1, 2.5).toFixed(2)})`
      });
    }
    frames.push({ transform: 'none', filter: 'none' });
    containerAnimate(frames, { duration: ms, easing: 'steps(1, end)' });
  };

  const FILTER_DEFAULTS = {
    blur: 0,
    grayscale: 0,
    sepia: 0,
    invert: 0,
    hueRotate: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100
  };
  const FILTER_RANGE = {
    blur: [0, 50],
    grayscale: [0, 100],
    sepia: [0, 100],
    invert: [0, 100],
    hueRotate: [-360, 360],
    brightness: [0, 300],
    contrast: [0, 300],
    saturate: [0, 500]
  };
  const FILTER_CSS = {
    blur: ['blur', 'px'],
    grayscale: ['grayscale', '%'],
    sepia: ['sepia', '%'],
    invert: ['invert', '%'],
    hueRotate: ['hue-rotate', 'deg'],
    brightness: ['brightness', '%'],
    contrast: ['contrast', '%'],
    saturate: ['saturate', '%']
  };
  const filters = { ...FILTER_DEFAULTS };

  const isFilter = (name) => Object.prototype.hasOwnProperty.call(FILTER_DEFAULTS, name);

  const applyFilters = () => {
    const canvas = runtime.renderer && runtime.renderer.canvas;
    if (!canvas) return;
    canvas.style.filter = Object.keys(filters)
      .filter((k) => filters[k] !== FILTER_DEFAULTS[k])
      .map((k) => `${FILTER_CSS[k][0]}(${Math.round(filters[k] * 100) / 100}${FILTER_CSS[k][1]})`)
      .join(' ');
  };

  const setFilter = (name, value) => {
    if (!isFilter(name)) return;
    filterTweens.delete(name);
    filters[name] = clamp(value, FILTER_RANGE[name][0], FILTER_RANGE[name][1]);
    applyFilters();
  };

  const tweenFilter = (name, target, ms) => {
    if (!isFilter(name)) return;
    const token = ++tweenSeq;
    filterTweens.set(name, token);
    const from = filters[name];
    const to = clamp(target, FILTER_RANGE[name][0], FILTER_RANGE[name][1]);
    const t0 = performance.now();
    const step = () => {
      if (filterTweens.get(name) !== token) return;
      const p = ms <= 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
      filters[name] = from + (to - from) * p;
      applyFilters();
      if (p < 1) requestAnimationFrame(step);
      else filterTweens.delete(name);
    };
    requestAnimationFrame(step);
  };

  const resetFilters = () => {
    filterTweens.clear();
    Object.assign(filters, FILTER_DEFAULTS);
    applyFilters();
  };

  const getOverlay = (key, z) => {
    let el = overlays.get(key);
    if (!el || !el.isConnected) {
      const container = getContainer();
      el = document.createElement('div');
      Object.assign(el.style, {
        position: positionMode(container),
        inset: '0',
        pointerEvents: 'none',
        zIndex: String(z)
      });
      container.appendChild(el);
      overlays.set(key, el);
    }
    return el;
  };

  const removeOverlay = (key) => {
    const el = overlays.get(key);
    if (el) el.remove();
    overlays.delete(key);
  };

  const tintScreen = (colorValue, percent) => {
    const el = getOverlay('tint', 100001);
    el.style.background = colorValue;
    el.style.opacity = String(clamp(percent, 0, 100) / 100);
  };

  const vignette = (colorValue, strength) => {
    const s = clamp(strength, 0, 100);
    if (s === 0) {
      removeOverlay('vignette');
      return;
    }
    const el = getOverlay('vignette', 100001);
    el.style.background = `radial-gradient(ellipse at center, ${rgba(colorValue, 0)} ${Math.round(65 - s * 0.45)}%, ${rgba(colorValue, Math.min(1, s / 100 + 0.1))} 100%)`;
  };

  const spotlight = (xPct, yPct, radius, darkness) => {
    const el = getOverlay('spotlight', 100001);
    const r = clamp(radius, 10, 3000);
    el.style.background = `radial-gradient(circle ${r}px at ${clamp(xPct, 0, 100)}% ${clamp(yPct, 0, 100)}%, rgba(0,0,0,0) ${Math.round(r * 0.55)}px, rgba(0,0,0,${clamp(darkness, 0, 100) / 100}) ${r}px)`;
  };

  const fadeScreen = (dir, colorValue, ms) =>
    new Promise((resolve) => {
      const duration = clamp(ms, 0, 30000);
      let el = overlays.get('fade');
      if (dir === 'to') {
        if (!el || !el.isConnected) {
          el = getOverlay('fade', 100007);
          el.style.opacity = '0';
        }
        el.style.background = colorValue;
        el.getBoundingClientRect();
        el.style.transition = `opacity ${duration}ms linear`;
        el.style.opacity = '1';
      } else {
        if (!el || !el.isConnected) {
          el = getOverlay('fade', 100007);
          el.style.background = colorValue;
          el.style.opacity = '1';
        }
        el.getBoundingClientRect();
        el.style.transition = `opacity ${duration}ms linear`;
        el.style.opacity = '0';
        setTimeout(() => {
          if (overlays.get('fade') === el && el.style.opacity === '0') removeOverlay('fade');
        }, duration + 50);
      }
      setTimeout(resolve, duration);
    });

  const stopAll = () => {
    Array.from(layers).forEach(removeLayer);
    falling = null;
    Array.from(overlays.keys()).forEach(removeOverlay);
    Array.from(anims).forEach((a) => a.cancel());
    anims.clear();
    resetFilters();
  };

  const COLORS = {
    effects: ['#f97316', '#ea580c', '#c2410c']
  };

  const B = (section, def) => ({
    color1: COLORS[section][0],
    color2: COLORS[section][1],
    color3: COLORS[section][2],
    ...def
  });

  const label = (text) => ({ blockType: BT.LABEL, text });

  const str = (defaultValue, menu) => {
    const a = { type: AT.STRING, defaultValue: defaultValue === undefined ? '' : defaultValue };
    if (menu) a.menu = menu;
    return a;
  };

  const num = (defaultValue, menu) => {
    const a = { type: AT.NUMBER, defaultValue: defaultValue === undefined ? 0 : defaultValue };
    if (menu) a.menu = menu;
    return a;
  };

  const color = (defaultValue) => ({ type: AT.COLOR, defaultValue });
  const items = (list) => ({ acceptReporters: true, items: list });
  const pairs = (list) => list.map(([text, value]) => ({ text, value }));

  runtime.on('PROJECT_STOP_ALL', stopAll);

  class AppEffects {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Effects',
        color1: '#f97316',
        color2: '#ea580c',
        color3: '#c2410c',
        blocks: [
          label('Particles'),
          B('effects', {
            opcode: 'confettiBurst',
            blockType: BT.COMMAND,
            text: 'confetti burst [COUNT] pieces at x [X]% y [Y]% colors [COLORS]',
            arguments: { COUNT: num(120), X: num(50), Y: num(60), COLORS: str('') }
          }),
          B('effects', {
            opcode: 'fireworks',
            blockType: BT.COMMAND,
            text: 'fireworks [COUNT] rockets colors [COLORS]',
            arguments: { COUNT: num(5), COLORS: str('') }
          }),
          B('effects', {
            opcode: 'emojiBurst',
            blockType: BT.COMMAND,
            text: 'emoji burst [EMOJI] [COUNT] pieces at x [X]% y [Y]%',
            arguments: { EMOJI: str('✨ 🎉 ⭐'), COUNT: num(30), X: num(50), Y: num(50) }
          }),
          B('effects', {
            opcode: 'startFalling',
            blockType: BT.COMMAND,
            text: 'start [KIND] effect for [SECS] seconds density [DENSITY]',
            arguments: { KIND: str('snow', 'fallKinds'), SECS: num(10), DENSITY: num(40) }
          }),
          B('effects', { opcode: 'stopFalling', blockType: BT.COMMAND, text: 'stop falling effect' }),

          label('Text & ripples'),
          B('effects', {
            opcode: 'floatText',
            blockType: BT.COMMAND,
            text: 'float text [TEXT] at x [X]% y [Y]% color [COLOR] size [SIZE] for [MS] ms',
            arguments: {
              TEXT: str('+100'),
              X: num(50),
              Y: num(50),
              COLOR: color('#fde047'),
              SIZE: num(32),
              MS: num(1200)
            }
          }),
          B('effects', {
            opcode: 'splashText',
            blockType: BT.COMMAND,
            text: 'splash text [TEXT] color [COLOR] size [SIZE] for [MS] ms',
            arguments: { TEXT: str('LEVEL UP!'), COLOR: color('#ffffff'), SIZE: num(72), MS: num(1800) }
          }),
          B('effects', {
            opcode: 'ripple',
            blockType: BT.COMMAND,
            text: 'ripple at x [X]% y [Y]% color [COLOR] size [SIZE] px for [MS] ms',
            arguments: { X: num(50), Y: num(50), COLOR: color('#38bdf8'), SIZE: num(200), MS: num(900) }
          }),

          label('Screen motion'),
          B('effects', {
            opcode: 'shakeScreen',
            blockType: BT.COMMAND,
            text: 'shake screen by [PX] px for [MS] ms',
            arguments: { PX: num(8), MS: num(400) }
          }),
          B('effects', {
            opcode: 'punchZoom',
            blockType: BT.COMMAND,
            text: 'punch zoom screen [PERCENT]% for [MS] ms',
            arguments: { PERCENT: num(8), MS: num(350) }
          }),
          B('effects', {
            opcode: 'spinScreen',
            blockType: BT.COMMAND,
            text: 'spin screen [DEG] degrees over [MS] ms',
            arguments: { DEG: num(360), MS: num(800) }
          }),
          B('effects', {
            opcode: 'wobbleScreen',
            blockType: BT.COMMAND,
            text: 'wobble screen for [MS] ms',
            arguments: { MS: num(700) }
          }),
          B('effects', {
            opcode: 'glitchScreen',
            blockType: BT.COMMAND,
            text: 'glitch screen for [MS] ms',
            arguments: { MS: num(500) }
          }),
          B('effects', {
            opcode: 'flashScreen',
            blockType: BT.COMMAND,
            text: 'flash screen [COLOR] for [MS] ms',
            arguments: { COLOR: color('#ffffff'), MS: num(300) }
          }),

          label('Screen look'),
          B('effects', {
            opcode: 'setFilter',
            blockType: BT.COMMAND,
            text: 'set screen [FILTER] to [AMOUNT]',
            arguments: { FILTER: str('blur', 'screenFilters'), AMOUNT: num(4) }
          }),
          B('effects', {
            opcode: 'tweenFilter',
            blockType: BT.COMMAND,
            text: 'animate screen [FILTER] to [AMOUNT] over [MS] ms',
            arguments: { FILTER: str('grayscale', 'screenFilters'), AMOUNT: num(100), MS: num(1000) }
          }),
          B('effects', {
            opcode: 'screenFilterValue',
            blockType: BT.REPORTER,
            text: 'screen [FILTER] value',
            arguments: { FILTER: str('blur', 'screenFilters') }
          }),
          B('effects', { opcode: 'resetFilters', blockType: BT.COMMAND, text: 'reset screen filters' }),
          '---',
          B('effects', {
            opcode: 'tintScreen',
            blockType: BT.COMMAND,
            text: 'tint screen [COLOR] opacity [PERCENT]%',
            arguments: { COLOR: color('#ff7a00'), PERCENT: num(20) }
          }),
          B('effects', {
            opcode: 'vignette',
            blockType: BT.COMMAND,
            text: 'vignette [COLOR] strength [PERCENT]%',
            arguments: { COLOR: color('#000000'), PERCENT: num(60) }
          }),
          B('effects', {
            opcode: 'spotlight',
            blockType: BT.COMMAND,
            text: 'spotlight at x [X]% y [Y]% radius [RADIUS] px darkness [PERCENT]%',
            arguments: { X: num(50), Y: num(50), RADIUS: num(160), PERCENT: num(80) }
          }),
          B('effects', {
            opcode: 'removeOverlay',
            blockType: BT.COMMAND,
            text: 'remove [OVERLAY]',
            arguments: { OVERLAY: str('all', 'overlayKinds') }
          }),
          '---',
          B('effects', {
            opcode: 'fadeScreen',
            blockType: BT.COMMAND,
            text: 'fade screen [DIR] [COLOR] over [MS] ms',
            arguments: { DIR: str('to', 'fadeDirs'), COLOR: color('#000000'), MS: num(800) }
          }),
          B('effects', {
            opcode: 'fadeScreenWait',
            blockType: BT.COMMAND,
            text: 'fade screen [DIR] [COLOR] over [MS] ms and wait',
            arguments: { DIR: str('to', 'fadeDirs'), COLOR: color('#000000'), MS: num(800) }
          }),
          '---',
          B('effects', { opcode: 'stopAllEffects', blockType: BT.COMMAND, text: 'stop all effects' })
        ],
        menus: {
          fallKinds: items(
            pairs(['snow', 'rain', 'leaves', 'stars', 'hearts', 'bubbles', 'embers'].map((x) => [x, x]))
          ),
          screenFilters: items(
            pairs([
              ['blur (px)', 'blur'],
              ['grayscale (%)', 'grayscale'],
              ['sepia (%)', 'sepia'],
              ['invert (%)', 'invert'],
              ['hue rotate (deg)', 'hueRotate'],
              ['brightness (%)', 'brightness'],
              ['contrast (%)', 'contrast'],
              ['saturation (%)', 'saturate']
            ])
          ),
          fadeDirs: items(
            pairs([
              ['to color', 'to'],
              ['from color', 'from']
            ])
          ),
          overlayKinds: items(
            pairs([
              ['tint', 'tint'],
              ['vignette', 'vignette'],
              ['spotlight', 'spotlight'],
              ['all overlays', 'all']
            ])
          )
        }
      };
    }

    confettiBurst({ COUNT, X, Y, COLORS }) {
      const list = parseList(COLORS)
        .map((c) => colorToHex(c))
        .filter(Boolean);
      confetti(clamp(Math.floor(Cast.toNumber(COUNT)), 1, 500), Cast.toNumber(X), Cast.toNumber(Y), list);
    }

    fireworks({ COUNT, COLORS }) {
      const list = parseList(COLORS)
        .map((c) => colorToHex(c))
        .filter(Boolean);
      fireworks(clamp(Math.floor(Cast.toNumber(COUNT)), 1, 20), list);
    }

    emojiBurst({ EMOJI, COUNT, X, Y }) {
      const glyphs = Cast.toString(EMOJI)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((g) => Array.from(g).slice(0, 8).join(''));
      emojiBurst(
        glyphs.length ? glyphs : ['✨'],
        clamp(Math.floor(Cast.toNumber(COUNT)), 1, 200),
        Cast.toNumber(X),
        Cast.toNumber(Y)
      );
    }

    startFalling({ KIND, SECS, DENSITY }) {
      startFalling(
        Cast.toString(KIND),
        Math.max(0, Cast.toNumber(SECS)),
        clamp(Cast.toNumber(DENSITY), 1, 300)
      );
    }

    stopFalling() {
      stopFalling();
    }

    floatText({ TEXT, X, Y, COLOR, SIZE, MS }) {
      popText(
        Cast.toString(TEXT).slice(0, 200),
        Cast.toNumber(X),
        Cast.toNumber(Y),
        safeColor(COLOR, '#ffffff'),
        clamp(Cast.toNumber(SIZE), 8, 200),
        clamp(Cast.toNumber(MS), 200, 15000),
        'float'
      );
    }

    splashText({ TEXT, COLOR, SIZE, MS }) {
      popText(
        Cast.toString(TEXT).slice(0, 200),
        50,
        50,
        safeColor(COLOR, '#ffffff'),
        clamp(Cast.toNumber(SIZE), 8, 300),
        clamp(Cast.toNumber(MS), 300, 15000),
        'splash'
      );
    }

    ripple({ X, Y, COLOR, SIZE, MS }) {
      ripple(
        Cast.toNumber(X),
        Cast.toNumber(Y),
        safeColor(COLOR, '#38bdf8'),
        clamp(Cast.toNumber(SIZE), 20, 2000),
        clamp(Cast.toNumber(MS), 150, 10000)
      );
    }

    shakeScreen({ PX, MS }) {
      shakeScreen(clamp(Cast.toNumber(PX), 0, 60), clamp(Cast.toNumber(MS), 50, 5000));
    }

    punchZoom({ PERCENT, MS }) {
      punchZoom(clamp(Cast.toNumber(PERCENT), -50, 100), clamp(Cast.toNumber(MS), 50, 5000));
    }

    spinScreen({ DEG, MS }) {
      spinScreen(clamp(Cast.toNumber(DEG), -3600, 3600), clamp(Cast.toNumber(MS), 50, 10000));
    }

    wobbleScreen({ MS }) {
      wobbleScreen(clamp(Cast.toNumber(MS), 100, 5000));
    }

    glitchScreen({ MS }) {
      glitchScreen(clamp(Cast.toNumber(MS), 100, 5000));
    }

    flashScreen({ COLOR, MS }) {
      flashScreen(safeColor(COLOR, '#ffffff'), clamp(Cast.toNumber(MS), 50, 5000));
    }

    setFilter({ FILTER, AMOUNT }) {
      setFilter(Cast.toString(FILTER), Cast.toNumber(AMOUNT));
    }

    tweenFilter({ FILTER, AMOUNT, MS }) {
      tweenFilter(Cast.toString(FILTER), Cast.toNumber(AMOUNT), clamp(Cast.toNumber(MS), 0, 60000));
    }

    screenFilterValue({ FILTER }) {
      const name = Cast.toString(FILTER);
      return isFilter(name) ? Math.round(filters[name] * 100) / 100 : 0;
    }

    resetFilters() {
      resetFilters();
    }

    tintScreen({ COLOR, PERCENT }) {
      tintScreen(safeColor(COLOR, '#ff7a00'), Cast.toNumber(PERCENT));
    }

    vignette({ COLOR, PERCENT }) {
      vignette(safeColor(COLOR, '#000000'), Cast.toNumber(PERCENT));
    }

    spotlight({ X, Y, RADIUS, PERCENT }) {
      spotlight(Cast.toNumber(X), Cast.toNumber(Y), Cast.toNumber(RADIUS), Cast.toNumber(PERCENT));
    }

    removeOverlay({ OVERLAY }) {
      const which = Cast.toString(OVERLAY);
      if (which === 'all') ['tint', 'vignette', 'spotlight', 'fade'].forEach(removeOverlay);
      else if (['tint', 'vignette', 'spotlight'].includes(which)) removeOverlay(which);
    }

    fadeScreen({ DIR, COLOR, MS }) {
      fadeScreen(
        Cast.toString(DIR) === 'from' ? 'from' : 'to',
        safeColor(COLOR, '#000000'),
        Cast.toNumber(MS)
      );
    }

    fadeScreenWait({ DIR, COLOR, MS }) {
      return fadeScreen(
        Cast.toString(DIR) === 'from' ? 'from' : 'to',
        safeColor(COLOR, '#000000'),
        Cast.toNumber(MS)
      );
    }

    stopAllEffects() {
      stopAll();
    }
  }

  Scratch.extensions.register(new AppEffects());
})(Scratch);
