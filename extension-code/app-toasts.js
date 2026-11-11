// Name: App Toasts
// ID: apptoasts
// Description: Fully customizable toasts and banners with themes, presets, animations, buttons and loading overlays.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Toasts must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'apptoasts';

  const state = {
    theme: 'auto',
    accent: '#8b5cf6',
    lastToastClicked: '',
    lastToastButton: '',
    lastToastId: ''
  };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const safeColor = (c, fallback) => {
    const s = Cast.toString(c).trim();
    try {
      if (window.CSS && CSS.supports('color', s)) return s;
    } catch (e) {}
    return fallback === undefined ? '#8b5cf6' : fallback;
  };

  const parseHex = (c) => {
    let s = Cast.toString(c).trim().replace('#', '');
    if (s.length === 3)
      s = s
        .split('')
        .map((x) => x + x)
        .join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };

  const toHex = (rgb) =>
    '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  const getContainer = () => {
    const canvas = runtime.renderer && runtime.renderer.canvas;
    const el = canvas && canvas.parentElement;
    if (!el) return document.body;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return el;
  };

  const positionMode = (container) => (container === document.body ? 'fixed' : 'absolute');

  const ensureStyle = () => {
    if (document.getElementById('apputils-style')) return;
    const s = document.createElement('style');
    s.id = 'apputils-style';
    s.textContent = '@keyframes apputils-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  };

  const isDark = () =>
    state.theme === 'dark' ||
    (state.theme === 'auto' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const palette = () =>
    isDark()
      ? { bg: '#1f2937', fg: '#f9fafb', border: '#374151', muted: '#9ca3af', input: '#111827' }
      : { bg: '#ffffff', fg: '#111827', border: '#e5e7eb', muted: '#6b7280', input: '#f9fafb' };

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

  const contrastOn = (c) => {
    const rgb = parseHex(colorToHex(c) || '');
    return rgb && 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 160 ? '#000000' : '#ffffff';
  };

  const colorOrEmpty = (v) => {
    const s = Cast.toString(v).trim();
    return !s || /^(default|auto|none)$/i.test(s) ? '' : safeColor(s, '');
  };

  const cloneDeep = (o) => JSON.parse(JSON.stringify(o));

  const cleanFont = (v) => {
    const s = Cast.toString(v)
      .replace(/[^\w\s,"'.-]/g, '')
      .trim()
      .slice(0, 120);
    return s || 'system-ui,sans-serif';
  };

  const TOAST_DEFAULTS = {
    position: 'bottom',
    animation: 'slide',
    accentBar: 'left',
    background: '',
    color: '',
    border: '',
    radius: 10,
    fontSize: 14,
    fontWeight: 400,
    fontFamily: 'system-ui,sans-serif',
    maxWidth: 360,
    padding: 10,
    gap: 8,
    margin: 12,
    opacity: 100,
    blur: 0,
    maxVisible: 5,
    shadow: true,
    showIcon: false,
    progress: false,
    closeButton: false,
    clickDismiss: false,
    clickable: true,
    typeColors: { info: '', success: '#22c55e', error: '#ef4444', warning: '#f59e0b' },
    icons: { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' }
  };

  const TOAST_SCHEMA = {
    position: ['enum', ['top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right', 'center']],
    animation: ['enum', ['slide', 'fade', 'zoom', 'bounce', 'none']],
    accentBar: ['enum', ['left', 'top', 'bottom', 'full', 'none']],
    background: ['color'],
    color: ['color'],
    border: ['color'],
    radius: ['num', 0, 80],
    fontSize: ['num', 8, 48],
    fontWeight: ['num', 100, 900],
    fontFamily: ['font'],
    maxWidth: ['num', 120, 1200],
    padding: ['num', 0, 60],
    gap: ['num', 0, 60],
    margin: ['num', 0, 120],
    opacity: ['num', 10, 100],
    blur: ['num', 0, 40],
    maxVisible: ['num', 1, 20],
    shadow: ['bool'],
    showIcon: ['bool'],
    progress: ['bool'],
    closeButton: ['bool'],
    clickDismiss: ['bool'],
    clickable: ['bool']
  };

  const toastStyle = cloneDeep(TOAST_DEFAULTS);

  const resetStyle = (target, defaults) => {
    Object.keys(target).forEach((k) => delete target[k]);
    Object.assign(target, cloneDeep(defaults));
  };

  const applyProp = (target, schema, key, value) => {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) return false;
    const def = schema[key];
    switch (def[0]) {
      case 'color': {
        const s = Cast.toString(value).trim();
        target[key] = !s || /^(default|auto|none)$/i.test(s) ? '' : safeColor(s, target[key]);
        return true;
      }
      case 'num':
        target[key] = clamp(Cast.toNumber(value), def[1], def[2]);
        return true;
      case 'font':
        target[key] = cleanFont(value);
        return true;
      case 'raw':
        target[key] = Cast.toString(value).slice(0, def[1]);
        return true;
      case 'enum': {
        const s = Cast.toString(value).trim().toLowerCase();
        const hit = def[1].find((x) => x.toLowerCase() === s);
        if (!hit) return false;
        target[key] = hit;
        return true;
      }
      case 'bool':
        target[key] =
          typeof value === 'boolean' ? value : /^(on|true|1|yes)$/i.test(Cast.toString(value).trim());
        return true;
      default:
        return false;
    }
  };

  const importStyle = (target, schema, text, nested) => {
    const r = parseJsonSafe(text);
    if (!r.ok || !r.value || typeof r.value !== 'object' || Array.isArray(r.value)) return false;
    Object.keys(r.value).forEach((k) => {
      if (FORBIDDEN_KEYS.has(k)) return;
      if (Object.prototype.hasOwnProperty.call(schema, k)) {
        applyProp(target, schema, k, r.value[k]);
      } else if (nested && nested.includes(k) && r.value[k] && typeof r.value[k] === 'object') {
        Object.keys(r.value[k]).forEach((t) => {
          if (!Object.prototype.hasOwnProperty.call(target[k], t)) return;
          target[k][t] =
            k === 'icons' ? Cast.toString(r.value[k][t]).slice(0, 16) : colorOrEmpty(r.value[k][t]);
        });
      }
    });
    return true;
  };

  const PRESETS = {
    light: {
      accent: '#8b5cf6',
      style: {
        background: '#ffffff',
        color: '#111827',
        border: '#e5e7eb'
      }
    },
    dark: {
      accent: '#8b5cf6',
      style: {
        background: '#1f2937',
        color: '#f9fafb',
        border: '#374151'
      }
    },
    glass: {
      accent: '#38bdf8',
      style: {
        background: 'rgba(255,255,255,0.14)',
        color: '#ffffff',
        border: 'rgba(255,255,255,0.35)',
        blur: 14,
        radius: 16,
        accentBar: 'none',
        animation: 'fade'
      }
    },
    neon: {
      accent: '#22d3ee',
      style: {
        background: '#0b1020',
        color: '#e0f2fe',
        border: '#22d3ee',
        radius: 6,
        accentBar: 'none',
        animation: 'zoom',
        showIcon: true,
        progress: true
      }
    },
    minimal: {
      accent: '#111827',
      style: {
        background: '#111827',
        color: '#ffffff',
        border: '#111827',
        radius: 4,
        shadow: false,
        accentBar: 'none',
        animation: 'fade',
        padding: 8
      }
    },
    pill: {
      accent: '#ec4899',
      style: {
        radius: 999,
        accentBar: 'none',
        showIcon: true,
        animation: 'bounce',
        position: 'top'
      }
    },
    retro: {
      accent: '#b45309',
      style: {
        background: '#fef3c7',
        color: '#451a03',
        border: '#451a03',
        radius: 0,
        fontFamily: 'Courier New,monospace',
        accentBar: 'bottom',
        shadow: false,
        animation: 'none'
      }
    }
  };

  const applyPreset = (name) => {
    resetStyle(toastStyle, TOAST_DEFAULTS);
    const p = PRESETS[name];
    if (!p) return;
    if (p.accent) state.accent = p.accent;
    Object.keys(p.style).forEach((k) => applyProp(toastStyle, TOAST_SCHEMA, k, p.style[k]));
  };

  const toastHosts = {};

  const toastRecs = new Map();

  const toastQueue = [];

  let toastSeq = 0;

  const getToastHost = (pos) => {
    const container = getContainer();
    let host = toastHosts[pos];
    if (!host || host.parentElement !== container) {
      if (host) host.remove();
      host = document.createElement('div');
      const v = pos.startsWith('top') ? 'top' : pos.startsWith('bottom') ? 'bottom' : 'middle';
      const h = pos.endsWith('left') ? 'left' : pos.endsWith('right') ? 'right' : 'center';
      Object.assign(host.style, {
        position: positionMode(container),
        display: 'flex',
        flexDirection: v === 'bottom' ? 'column-reverse' : 'column',
        alignItems: h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center',
        justifyContent: v === 'middle' ? 'center' : 'flex-start',
        pointerEvents: 'none',
        zIndex: '99999',
        boxSizing: 'border-box',
        maxWidth: '100%',
        left: h === 'right' ? 'auto' : '0',
        right: h === 'left' ? 'auto' : '0',
        top: v === 'bottom' ? 'auto' : '0',
        bottom: v === 'top' ? 'auto' : '0'
      });
      container.appendChild(host);
      toastHosts[pos] = host;
    }
    host.style.padding = `${toastStyle.margin}px`;
    host.style.gap = `${toastStyle.gap}px`;
    return host;
  };

  const animFrom = (anim, pos) => {
    switch (anim) {
      case 'fade':
      case 'none':
        return 'none';
      case 'zoom':
        return 'scale(.85)';
      case 'bounce':
        return 'scale(.6)';
      default:
        if (pos.endsWith('left')) return 'translateX(-24px)';
        if (pos.endsWith('right')) return 'translateX(24px)';
        return `translateY(${pos.startsWith('top') ? -12 : 12}px)`;
    }
  };

  const dismissToastRec = (rec, instant) => {
    if (!rec || rec.gone) return;
    rec.gone = true;
    clearTimeout(rec.timer);
    if (toastRecs.get(rec.id) === rec) toastRecs.delete(rec.id);
    const i = toastQueue.indexOf(rec);
    if (i >= 0) toastQueue.splice(i, 1);
    if (instant || rec.anim === 'none') {
      rec.el.remove();
      return;
    }
    rec.el.style.opacity = '0';
    if (rec.from !== 'none') rec.el.style.transform = rec.from;
    setTimeout(() => rec.el.remove(), 260);
  };

  const pushToast = (o) => {
    const ts = toastStyle;
    const p = palette();
    const type = ['success', 'error', 'warning'].includes(o.type) ? o.type : 'info';
    const id = o.id || `toast-${++toastSeq}`;
    if (toastRecs.has(id)) dismissToastRec(toastRecs.get(id), true);

    const accent = ts.typeColors[type] || state.accent;
    const full = ts.accentBar === 'full';
    const bg = full ? accent : ts.background || p.bg;
    const fg = full ? contrastOn(accent) : ts.color || p.fg;
    const pos = ts.position;
    const anim = ts.animation;
    const from = animFrom(anim, pos);
    const ms = o.seconds > 0 ? Math.max(500, o.seconds * 1000) : 0;
    const finalOpacity = ts.opacity / 100;
    const clickDismiss = ts.clickDismiss;
    const text = String(o.text).slice(0, 1000);

    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      maxWidth: `min(${ts.maxWidth}px, 100%)`,
      padding: `${ts.padding}px ${ts.padding + 6}px`,
      borderRadius: `${ts.radius}px`,
      fontFamily: ts.fontFamily,
      fontSize: `${ts.fontSize}px`,
      fontWeight: String(ts.fontWeight),
      lineHeight: '1.4',
      background: bg,
      color: fg,
      border: `1px solid ${full ? accent : ts.border || p.border}`,
      boxShadow: ts.shadow ? '0 6px 20px rgba(0,0,0,.25)' : 'none',
      backdropFilter: ts.blur > 0 ? `blur(${ts.blur}px)` : '',
      opacity: anim === 'none' ? String(finalOpacity) : '0',
      transform: from,
      transition:
        anim === 'none'
          ? 'none'
          : `opacity .22s, transform ${anim === 'bounce' ? '.4s cubic-bezier(.34,1.56,.64,1)' : '.22s'}`,
      pointerEvents: ts.clickable ? 'auto' : 'none',
      cursor: ts.clickable && clickDismiss ? 'pointer' : 'default'
    });
    const barCss = `4px solid ${accent}`;
    if (ts.accentBar === 'left') el.style.borderLeft = barCss;
    else if (ts.accentBar === 'top') el.style.borderTop = barCss;
    else if (ts.accentBar === 'bottom') el.style.borderBottom = barCss;

    if (ts.showIcon && ts.icons[type]) {
      const ic = document.createElement('span');
      ic.textContent = ts.icons[type];
      Object.assign(ic.style, { fontSize: '1.25em', lineHeight: '1', flex: 'none' });
      el.appendChild(ic);
    }

    const body = document.createElement('div');
    Object.assign(body.style, { flex: '1 1 auto', minWidth: '0', wordBreak: 'break-word' });
    if (o.title) {
      const t = document.createElement('div');
      t.textContent = String(o.title).slice(0, 200);
      Object.assign(t.style, { fontWeight: '700', marginBottom: '2px' });
      body.appendChild(t);
    }
    const msgEl = document.createElement('div');
    msgEl.textContent = text;
    msgEl.style.whiteSpace = 'pre-wrap';
    body.appendChild(msgEl);
    el.appendChild(body);

    const rec = { id, el, msgEl, text, from, anim, timer: null, gone: false };

    if (o.button) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = o.button;
      Object.assign(btn.style, {
        flex: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: `${Math.max(0, ts.radius - 4)}px`,
        fontFamily: 'inherit',
        fontSize: '0.9em',
        fontWeight: '700',
        background: full ? 'rgba(255,255,255,.25)' : rgba(accent, 0.18),
        color: full ? fg : accent,
        pointerEvents: 'auto'
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.lastToastButton = o.button;
        state.lastToastId = id;
        state.lastToastClicked = rec.text;
        fire('whenToastButtonClicked');
        dismissToastRec(rec);
      });
      el.appendChild(btn);
    }

    if (ts.closeButton) {
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Close');
      Object.assign(x.style, {
        flex: 'none',
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        opacity: '0.7',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px 4px',
        pointerEvents: 'auto'
      });
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToastRec(rec);
      });
      el.appendChild(x);
    }

    let bar = null;
    if (ts.progress && ms > 0) {
      bar = document.createElement('div');
      Object.assign(bar.style, {
        position: 'absolute',
        left: '0',
        bottom: '0',
        height: '3px',
        width: '100%',
        background: full ? 'rgba(255,255,255,.6)' : accent,
        opacity: '0.85'
      });
      el.appendChild(bar);
    }

    el.addEventListener('click', () => {
      state.lastToastClicked = rec.text;
      state.lastToastId = id;
      fire('whenToastClicked');
      if (clickDismiss) dismissToastRec(rec);
    });

    getToastHost(pos).appendChild(el);
    toastQueue.push(rec);
    toastRecs.set(id, rec);
    while (toastQueue.length > ts.maxVisible) dismissToastRec(toastQueue[0]);

    requestAnimationFrame(() => {
      el.style.opacity = String(finalOpacity);
      el.style.transform = 'none';
      if (bar && bar.animate) {
        bar.animate([{ width: '100%' }, { width: '0%' }], {
          duration: ms,
          easing: 'linear',
          fill: 'forwards'
        });
      }
    });
    if (ms > 0) rec.timer = setTimeout(() => dismissToastRec(rec), ms);
  };

  const clearToastHosts = () => {
    Array.from(toastQueue).forEach((r) => dismissToastRec(r, true));
    Object.keys(toastHosts).forEach((k) => {
      toastHosts[k].remove();
      delete toastHosts[k];
    });
  };

  let bannerEl = null;

  const hideBanner = () => {
    if (bannerEl) bannerEl.remove();
    bannerEl = null;
  };

  const showBanner = (text, type, closable) => {
    hideBanner();
    const ts = toastStyle;
    const container = getContainer();
    const t = ['success', 'error', 'warning'].includes(type) ? type : 'info';
    const accent = ts.typeColors[t] || state.accent;
    bannerEl = document.createElement('div');
    Object.assign(bannerEl.style, {
      position: positionMode(container),
      left: '0',
      right: '0',
      top: '0',
      zIndex: '99997',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: `${ts.padding}px 16px`,
      boxSizing: 'border-box',
      background: accent,
      color: contrastOn(accent),
      fontFamily: ts.fontFamily,
      fontSize: `${ts.fontSize}px`,
      fontWeight: '600',
      textAlign: 'center'
    });
    const span = document.createElement('span');
    span.textContent = (ts.showIcon && ts.icons[t] ? `${ts.icons[t]} ` : '') + text;
    span.style.whiteSpace = 'pre-wrap';
    bannerEl.appendChild(span);
    if (closable) {
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Close');
      Object.assign(x.style, {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '15px'
      });
      x.addEventListener('click', hideBanner);
      bannerEl.appendChild(x);
    }
    container.appendChild(bannerEl);
  };

  let loadingEl = null;

  let loadingTextEl = null;

  const hideLoading = () => {
    if (loadingEl) loadingEl.remove();
    loadingEl = null;
    loadingTextEl = null;
  };

  const showLoading = (text) => {
    ensureStyle();
    const container = getContainer();
    if (!loadingEl || loadingEl.parentElement !== container) {
      hideLoading();
      loadingEl = document.createElement('div');
      loadingEl.style.cssText =
        `position:${positionMode(container)};inset:0;display:flex;flex-direction:column;align-items:center;` +
        'justify-content:center;gap:14px;background:rgba(0,0,0,.55);z-index:100001;font-family:system-ui,sans-serif;color:#fff;';
      const spinner = document.createElement('div');
      spinner.style.cssText =
        'width:38px;height:38px;border-radius:50%;border:4px solid rgba(255,255,255,.25);' +
        `border-top-color:${state.accent};animation:apputils-spin .8s linear infinite;`;
      loadingTextEl = document.createElement('div');
      loadingTextEl.style.cssText = 'font-size:14px;max-width:80%;text-align:center;';
      loadingEl.appendChild(spinner);
      loadingEl.appendChild(loadingTextEl);
      container.appendChild(loadingEl);
    }
    loadingTextEl.textContent = text;
  };

  let barEl = null;

  let barFill = null;

  const hideProgress = () => {
    if (barEl) barEl.remove();
    barEl = null;
    barFill = null;
  };

  const showProgress = (percent) => {
    const container = getContainer();
    if (!barEl || barEl.parentElement !== container) {
      hideProgress();
      barEl = document.createElement('div');
      barEl.style.cssText = `position:${positionMode(container)};left:0;right:0;top:0;height:4px;background:rgba(127,127,127,.25);z-index:100002;pointer-events:none;`;
      barFill = document.createElement('div');
      barFill.style.cssText = 'height:100%;width:0;transition:width .2s;';
      barEl.appendChild(barFill);
      container.appendChild(barEl);
    }
    barFill.style.background = state.accent;
    barFill.style.width = `${clamp(percent, 0, 100)}%`;
  };

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const parseJsonSafe = (text) => {
    try {
      return { ok: true, value: JSON.parse(Cast.toString(text)) };
    } catch (e) {
      return { ok: false, value: undefined };
    }
  };

  const COLORS = {
    ui: ['#8b5cf6', '#7c3aed', '#6d28d9']
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

  const addLog = (text, level) => {
    const fn = console[level] || console.log;
    fn.call(console, `[App Toasts] ${text}`);
  };

  runtime.on('PROJECT_STOP_ALL', () => {
    Array.from(toastQueue).forEach((r) => dismissToastRec(r, true));
    hideLoading();
  });

  class AppToasts {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Toasts',
        color1: '#8b5cf6',
        color2: '#7c3aed',
        color3: '#6d28d9',
        blocks: [
          label('Toasts'),
          B('ui', {
            opcode: 'showToast',
            blockType: BT.COMMAND,
            text: 'show toast [TEXT] as [TYPE] for [SECS] seconds',
            arguments: { TEXT: str('Saved successfully!'), TYPE: str('success', 'toastTypes'), SECS: num(3) }
          }),
          B('ui', {
            opcode: 'showToastAdvanced',
            blockType: BT.COMMAND,
            text: 'show toast title [TITLE] text [TEXT] as [TYPE] for [SECS] seconds button [BUTTON] ID [ID]',
            arguments: {
              TITLE: str('New message'),
              TEXT: str('You have mail'),
              TYPE: str('info', 'toastTypes'),
              SECS: num(4),
              BUTTON: str('Open'),
              ID: str('mail')
            }
          }),
          B('ui', {
            opcode: 'updateToast',
            blockType: BT.COMMAND,
            text: 'update toast [ID] text to [TEXT]',
            arguments: { ID: str('mail'), TEXT: str('Uploading... 80%') }
          }),
          B('ui', {
            opcode: 'dismissToast',
            blockType: BT.COMMAND,
            text: 'dismiss toast [ID]',
            arguments: { ID: str('mail') }
          }),
          B('ui', {
            opcode: 'toastShowing',
            blockType: BT.BOOLEAN,
            text: 'toast [ID] is showing?',
            arguments: { ID: str('mail') }
          }),
          B('ui', { opcode: 'clearToasts', blockType: BT.COMMAND, text: 'clear all toasts' }),
          '---',
          B('ui', {
            opcode: 'whenToastClicked',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when a toast is clicked'
          }),
          B('ui', {
            opcode: 'whenToastButtonClicked',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when toast button [BUTTON] is clicked',
            arguments: { BUTTON: str('Open') }
          }),
          B('ui', {
            opcode: 'lastToastClickedText',
            blockType: BT.REPORTER,
            text: 'last clicked toast text'
          }),
          B('ui', {
            opcode: 'lastToastButtonText',
            blockType: BT.REPORTER,
            text: 'last toast button clicked'
          }),
          B('ui', { opcode: 'lastToastIdText', blockType: BT.REPORTER, text: 'last clicked toast ID' }),
          '---',
          B('ui', {
            opcode: 'showBanner',
            blockType: BT.COMMAND,
            text: 'show top banner [TEXT] as [TYPE] closable: [CLOSABLE]',
            arguments: {
              TEXT: str('New version available!'),
              TYPE: str('info', 'toastTypes'),
              CLOSABLE: str('on', 'onOff')
            }
          }),
          B('ui', { opcode: 'hideBanner', blockType: BT.COMMAND, text: 'hide top banner' }),

          label('Toast style'),
          B('ui', {
            opcode: 'setToastPosition',
            blockType: BT.COMMAND,
            text: 'set toast position to [POS]',
            arguments: { POS: str('bottom', 'toastPositions') }
          }),
          B('ui', {
            opcode: 'setToastProp',
            blockType: BT.COMMAND,
            text: 'set toast [PROP] to [VALUE]',
            arguments: { PROP: str('background', 'toastProps'), VALUE: str('#1e293b') }
          }),
          B('ui', {
            opcode: 'setToastTypeColor',
            blockType: BT.COMMAND,
            text: 'set toast [TYPE] accent color to [COLOR]',
            arguments: { TYPE: str('success', 'toastTypes'), COLOR: color('#22c55e') }
          }),
          B('ui', {
            opcode: 'setToastTypeIcon',
            blockType: BT.COMMAND,
            text: 'set toast [TYPE] icon to [ICON]',
            arguments: { TYPE: str('success', 'toastTypes'), ICON: str('🎉') }
          }),
          B('ui', {
            opcode: 'setToastAnimation',
            blockType: BT.COMMAND,
            text: 'set toast animation to [ANIM]',
            arguments: { ANIM: str('slide', 'toastAnimations') }
          }),
          B('ui', {
            opcode: 'setToastBar',
            blockType: BT.COMMAND,
            text: 'set toast accent style to [BAR]',
            arguments: { BAR: str('left', 'toastBars') }
          }),
          B('ui', {
            opcode: 'setToastOption',
            blockType: BT.COMMAND,
            text: 'toast [OPTION]: [STATE]',
            arguments: { OPTION: str('progress', 'toastOptions'), STATE: str('on', 'onOff') }
          }),
          B('ui', {
            opcode: 'toastStyleJson',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'toast style as JSON object'
          }),
          B('ui', {
            opcode: 'setToastStyleJson',
            blockType: BT.COMMAND,
            text: 'set toast style from JSON [JSON]',
            arguments: {
              JSON: str('{"radius":20,"background":"#0f172a","color":"#fff","animation":"bounce"}')
            }
          }),
          B('ui', { opcode: 'resetToastStyle', blockType: BT.COMMAND, text: 'reset toast style' }),
          B('ui', {
            opcode: 'applyPreset',
            blockType: BT.COMMAND,
            text: 'apply style preset [PRESET] to toasts',
            arguments: { PRESET: str('glass', 'stylePresets') }
          }),
          label('Loading & Theme'),
          B('ui', {
            opcode: 'showLoading',
            blockType: BT.COMMAND,
            text: 'show loading overlay [TEXT]',
            arguments: { TEXT: str('Loading...') }
          }),
          B('ui', { opcode: 'hideLoading', blockType: BT.COMMAND, text: 'hide loading overlay' }),
          B('ui', {
            opcode: 'showProgress',
            blockType: BT.COMMAND,
            text: 'set progress bar to [PERCENT]%',
            arguments: { PERCENT: num(50) }
          }),
          B('ui', { opcode: 'hideProgress', blockType: BT.COMMAND, text: 'hide progress bar' }),
          '---',
          B('ui', {
            opcode: 'setTheme',
            blockType: BT.COMMAND,
            text: 'set toast theme to [THEME]',
            arguments: { THEME: str('auto', 'themes') }
          }),
          B('ui', {
            opcode: 'setAccent',
            blockType: BT.COMMAND,
            text: 'set default toast accent color to [COLOR]',
            arguments: { COLOR: color('#8b5cf6') }
          }),
          B('ui', { opcode: 'themeIsDark', blockType: BT.BOOLEAN, text: 'toast theme is dark?' })
        ],
        menus: {
          toastTypes: items(
            pairs([
              ['info', 'info'],
              ['success', 'success'],
              ['error', 'error'],
              ['warning', 'warning']
            ])
          ),
          toastPositions: items(
            pairs([
              ['bottom', 'bottom'],
              ['bottom left', 'bottom-left'],
              ['bottom right', 'bottom-right'],
              ['top', 'top'],
              ['top left', 'top-left'],
              ['top right', 'top-right'],
              ['center', 'center']
            ])
          ),
          toastProps: items(
            pairs([
              ['background color', 'background'],
              ['text color', 'color'],
              ['border color', 'border'],
              ['corner radius', 'radius'],
              ['font size', 'fontSize'],
              ['font weight', 'fontWeight'],
              ['font family', 'fontFamily'],
              ['max width', 'maxWidth'],
              ['padding', 'padding'],
              ['spacing between toasts', 'gap'],
              ['screen margin', 'margin'],
              ['opacity (%)', 'opacity'],
              ['background blur', 'blur'],
              ['max visible at once', 'maxVisible']
            ])
          ),
          toastAnimations: items(
            pairs([
              ['slide', 'slide'],
              ['fade', 'fade'],
              ['zoom', 'zoom'],
              ['bounce', 'bounce'],
              ['none', 'none']
            ])
          ),
          toastBars: items(
            pairs([
              ['left edge', 'left'],
              ['top edge', 'top'],
              ['bottom edge', 'bottom'],
              ['full color background', 'full'],
              ['none', 'none']
            ])
          ),
          toastOptions: items(
            pairs([
              ['icons', 'showIcon'],
              ['progress bar', 'progress'],
              ['close button', 'closeButton'],
              ['click to dismiss', 'clickDismiss'],
              ['clickable', 'clickable'],
              ['shadow', 'shadow']
            ])
          ),
          stylePresets: items(
            pairs(
              ['default', 'light', 'dark', 'glass', 'neon', 'minimal', 'pill', 'retro'].map((x) => [x, x])
            )
          ),
          themes: items(
            pairs([
              ['auto', 'auto'],
              ['light', 'light'],
              ['dark', 'dark']
            ])
          ),
          onOff: items(
            pairs([
              ['on', 'on'],
              ['off', 'off']
            ])
          )
        }
      };
    }

    showToast({ TEXT, TYPE, SECS }) {
      pushToast({ text: Cast.toString(TEXT), type: Cast.toString(TYPE), seconds: Cast.toNumber(SECS) || 3 });
    }

    showToastAdvanced({ TITLE, TEXT, TYPE, SECS, BUTTON, ID }) {
      pushToast({
        title: Cast.toString(TITLE),
        text: Cast.toString(TEXT),
        type: Cast.toString(TYPE),
        seconds: Math.max(0, Cast.toNumber(SECS)),
        button: Cast.toString(BUTTON).trim().slice(0, 30),
        id: Cast.toString(ID).trim()
      });
    }

    updateToast({ ID, TEXT }) {
      const rec = toastRecs.get(Cast.toString(ID).trim());
      if (!rec) return;
      rec.text = Cast.toString(TEXT).slice(0, 1000);
      rec.msgEl.textContent = rec.text;
    }

    dismissToast({ ID }) {
      dismissToastRec(toastRecs.get(Cast.toString(ID).trim()));
    }

    toastShowing({ ID }) {
      return toastRecs.has(Cast.toString(ID).trim());
    }

    clearToasts() {
      clearToastHosts();
    }

    whenToastClicked() {
      return true;
    }

    whenToastButtonClicked({ BUTTON }) {
      const b = Cast.toString(BUTTON).trim();
      return b === '' || b.toLowerCase() === 'any' || b === state.lastToastButton;
    }

    lastToastClickedText() {
      return state.lastToastClicked;
    }

    lastToastButtonText() {
      return state.lastToastButton;
    }

    lastToastIdText() {
      return state.lastToastId;
    }

    showBanner({ TEXT, TYPE, CLOSABLE }) {
      showBanner(Cast.toString(TEXT), Cast.toString(TYPE), Cast.toString(CLOSABLE) === 'on');
    }

    hideBanner() {
      hideBanner();
    }

    setToastPosition({ POS }) {
      applyProp(toastStyle, TOAST_SCHEMA, 'position', POS);
    }

    setToastProp({ PROP, VALUE }) {
      applyProp(toastStyle, TOAST_SCHEMA, Cast.toString(PROP), VALUE);
    }

    setToastTypeColor({ TYPE, COLOR }) {
      const t = Cast.toString(TYPE);
      if (Object.prototype.hasOwnProperty.call(toastStyle.typeColors, t)) {
        toastStyle.typeColors[t] = colorOrEmpty(COLOR);
      }
    }

    setToastTypeIcon({ TYPE, ICON }) {
      const t = Cast.toString(TYPE);
      if (Object.prototype.hasOwnProperty.call(toastStyle.icons, t)) {
        toastStyle.icons[t] = Cast.toString(ICON).slice(0, 16);
      }
    }

    setToastAnimation({ ANIM }) {
      applyProp(toastStyle, TOAST_SCHEMA, 'animation', ANIM);
    }

    setToastBar({ BAR }) {
      applyProp(toastStyle, TOAST_SCHEMA, 'accentBar', BAR);
    }

    setToastOption({ OPTION, STATE }) {
      const key = Cast.toString(OPTION);
      const def = TOAST_SCHEMA[key];
      if (def && def[0] === 'bool') applyProp(toastStyle, TOAST_SCHEMA, key, STATE);
    }

    toastStyleJson() {
      return JSON.stringify(toastStyle);
    }

    setToastStyleJson({ JSON: json }) {
      if (!importStyle(toastStyle, TOAST_SCHEMA, json, ['typeColors', 'icons'])) {
        addLog('set toast style: expected a JSON object', 'error', 'style');
      }
    }

    resetToastStyle() {
      resetStyle(toastStyle, TOAST_DEFAULTS);
    }

    applyPreset({ PRESET }) {
      applyPreset(Cast.toString(PRESET));
    }

    showLoading({ TEXT }) {
      showLoading(Cast.toString(TEXT));
    }

    hideLoading() {
      hideLoading();
    }

    showProgress({ PERCENT }) {
      showProgress(Cast.toNumber(PERCENT));
    }

    hideProgress() {
      hideProgress();
    }

    setTheme({ THEME }) {
      const t = Cast.toString(THEME);
      state.theme = t === 'light' || t === 'dark' ? t : 'auto';
    }

    setAccent({ COLOR }) {
      state.accent = safeColor(COLOR, state.accent);
    }

    themeIsDark() {
      return isDark();
    }
  }

  Scratch.extensions.register(new AppToasts());
})(Scratch);
