// Name: App Dialogs
// ID: appdialogs
// Description: Fully customizable alert, confirm, prompt, choice and picker dialogs with themes and presets.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Dialogs must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appdialogs';

  const state = {
    theme: 'auto',
    accent: '#8b5cf6',
    lastAskCancelled: false
  };

  const modalClosers = new Set();

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

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

  const isDarkColor = (c) => {
    const rgb = parseHex(colorToHex(c) || '');
    return rgb ? 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 140 : isDark();
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

  const DIALOG_DEFAULTS = {
    background: '',
    color: '',
    border: '',
    mutedColor: '',
    inputBackground: '',
    primaryColor: '',
    overlayColor: '#000000',
    overlayOpacity: 50,
    blur: 0,
    radius: 14,
    width: 380,
    padding: 20,
    titleSize: 17,
    messageSize: 14,
    fontFamily: 'system-ui,sans-serif',
    animation: 'zoom',
    buttonStyle: 'filled',
    buttonAlign: 'right',
    buttonRadius: 8,
    textAlign: 'left',
    icon: '',
    defaultTitle: '',
    okLabel: 'OK',
    cancelLabel: 'Cancel',
    shadow: true,
    closeOnOverlay: false,
    showClose: false
  };

  const DIALOG_SCHEMA = {
    background: ['color'],
    color: ['color'],
    border: ['color'],
    mutedColor: ['color'],
    inputBackground: ['color'],
    primaryColor: ['color'],
    overlayColor: ['color'],
    overlayOpacity: ['num', 0, 100],
    blur: ['num', 0, 30],
    radius: ['num', 0, 60],
    width: ['num', 200, 900],
    padding: ['num', 4, 60],
    titleSize: ['num', 10, 48],
    messageSize: ['num', 8, 32],
    fontFamily: ['font'],
    animation: ['enum', ['zoom', 'slide', 'fade', 'none']],
    buttonStyle: ['enum', ['filled', 'outline', 'soft']],
    buttonAlign: ['enum', ['left', 'center', 'right', 'stretch']],
    buttonRadius: ['num', 0, 40],
    textAlign: ['enum', ['left', 'center', 'right']],
    icon: ['raw', 16],
    defaultTitle: ['raw', 80],
    okLabel: ['raw', 30],
    cancelLabel: ['raw', 30],
    shadow: ['bool'],
    closeOnOverlay: ['bool'],
    showClose: ['bool']
  };

  const dialogStyle = cloneDeep(DIALOG_DEFAULTS);

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
        border: '#e5e7eb',
        mutedColor: '#6b7280',
        inputBackground: '#f9fafb'
      }
    },
    dark: {
      accent: '#8b5cf6',
      style: {
        background: '#1f2937',
        color: '#f9fafb',
        border: '#374151',
        mutedColor: '#9ca3af',
        inputBackground: '#111827'
      }
    },
    glass: {
      accent: '#38bdf8',
      style: {
        background: 'rgba(30,41,59,0.55)',
        color: '#ffffff',
        border: 'rgba(255,255,255,0.25)',
        mutedColor: '#cbd5e1',
        inputBackground: 'rgba(255,255,255,0.12)',
        blur: 10,
        radius: 20,
        buttonStyle: 'soft',
        animation: 'fade',
        overlayOpacity: 35
      }
    },
    neon: {
      accent: '#22d3ee',
      style: {
        background: '#0b1020',
        color: '#e0f2fe',
        border: '#22d3ee',
        mutedColor: '#7dd3fc',
        inputBackground: '#111a33',
        radius: 8,
        buttonStyle: 'outline',
        buttonRadius: 4,
        overlayOpacity: 70
      }
    },
    minimal: {
      accent: '#111827',
      style: {
        background: '#ffffff',
        color: '#111827',
        border: '#d1d5db',
        mutedColor: '#6b7280',
        inputBackground: '#ffffff',
        radius: 4,
        shadow: false,
        buttonRadius: 4,
        animation: 'fade',
        overlayOpacity: 30
      }
    },
    pill: {
      accent: '#ec4899',
      style: {
        radius: 28,
        buttonRadius: 999,
        buttonAlign: 'center',
        textAlign: 'center',
        animation: 'zoom'
      }
    },
    retro: {
      accent: '#b45309',
      style: {
        background: '#fef3c7',
        color: '#451a03',
        border: '#451a03',
        mutedColor: '#78350f',
        inputBackground: '#fffbeb',
        radius: 0,
        fontFamily: 'Courier New,monospace',
        buttonStyle: 'outline',
        buttonRadius: 0,
        shadow: false,
        animation: 'none',
        overlayOpacity: 40
      }
    }
  };

  const applyPreset = (name) => {
    resetStyle(dialogStyle, DIALOG_DEFAULTS);
    const p = PRESETS[name];
    if (!p) return;
    if (p.accent) dialogStyle.primaryColor = p.accent;
    Object.keys(p.style).forEach((k) => applyProp(dialogStyle, DIALOG_SCHEMA, k, p.style[k]));
  };

  const dialogColors = () => {
    const p = palette();
    const ds = dialogStyle;
    return {
      bg: ds.background || p.bg,
      fg: ds.color || p.fg,
      border: ds.border || p.border,
      muted: ds.mutedColor || p.muted,
      input: ds.inputBackground || p.input,
      primary: ds.primaryColor || state.accent,
      dark: ds.background ? isDarkColor(ds.background) : isDark()
    };
  };

  let dialogUid = 0;

  const TEXTLIKE = ['text', 'password', 'email', 'number', 'date', 'time', 'datetime-local', 'tel', 'url'];

  const buildField = (f, c) => {
    const type = f.type || 'text';
    const uid = ++dialogUid;
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { marginBottom: '12px', textAlign: 'left' });
    const css = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 11px',
      borderRadius: '8px',
      border: `1px solid ${c.border}`,
      background: c.input,
      color: c.fg,
      fontSize: '14px',
      outline: 'none',
      fontFamily: 'inherit',
      colorScheme: c.dark ? 'dark' : 'light'
    };
    if (f.label && type !== 'checkbox') {
      const l = document.createElement('div');
      l.textContent = f.label + (f.required ? ' *' : '');
      Object.assign(l.style, { fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: c.fg });
      wrap.appendChild(l);
    }

    let input;
    let get;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
      Object.assign(input.style, css, { resize: 'vertical' });
      input.value = f.value || '';
      if (f.placeholder) input.placeholder = f.placeholder;
      get = () => input.value;
      wrap.appendChild(input);
    } else if (type === 'select') {
      input = document.createElement('select');
      Object.assign(input.style, css);
      (f.options || []).forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
      if (f.value) input.value = f.value;
      get = () => input.value;
      wrap.appendChild(input);
    } else if (type === 'radio') {
      const group = document.createElement('div');
      const radios = [];
      (f.options || []).forEach((o) => {
        const row = document.createElement('label');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: c.fg,
          padding: '3px 0',
          cursor: 'pointer'
        });
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = `au-radio-${uid}`;
        r.value = o;
        r.checked = f.value === o;
        r.disabled = !!f.disabled;
        r.style.accentColor = c.primary;
        const t = document.createElement('span');
        t.textContent = o;
        row.appendChild(r);
        row.appendChild(t);
        group.appendChild(row);
        radios.push(r);
      });
      input = radios[0] || group;
      get = () => {
        const r = radios.find((x) => x.checked);
        return r ? r.value : '';
      };
      wrap.appendChild(group);
    } else if (type === 'checkbox') {
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        color: c.fg,
        cursor: 'pointer'
      });
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = /^(true|1|on|yes)$/i.test(String(f.value));
      input.style.accentColor = c.primary;
      const t = document.createElement('span');
      t.textContent = (f.label || f.name) + (f.required ? ' *' : '');
      row.appendChild(input);
      row.appendChild(t);
      get = () => input.checked;
      wrap.appendChild(row);
    } else if (type === 'range') {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '10px' });
      input = document.createElement('input');
      input.type = 'range';
      input.min = f.min === '' || f.min === undefined ? '0' : String(f.min);
      input.max = f.max === '' || f.max === undefined ? '100' : String(f.max);
      input.step = f.step === '' || f.step === undefined ? '1' : String(f.step);
      input.value = f.value === '' || f.value === undefined ? input.min : String(f.value);
      Object.assign(input.style, { flex: '1', accentColor: c.primary });
      const out = document.createElement('span');
      out.textContent = input.value;
      Object.assign(out.style, { minWidth: '3ch', textAlign: 'right', fontSize: '14px', color: c.fg });
      input.addEventListener('input', () => {
        out.textContent = input.value;
      });
      row.appendChild(input);
      row.appendChild(out);
      get = () => input.value;
      wrap.appendChild(row);
    } else if (type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.value = colorToHex(f.value || '#8b5cf6') || '#8b5cf6';
      Object.assign(input.style, css, { height: '40px', padding: '3px', cursor: 'pointer' });
      get = () => input.value;
      wrap.appendChild(input);
    } else {
      input = document.createElement('input');
      input.type = TEXTLIKE.includes(type) ? type : 'text';
      Object.assign(input.style, css);
      input.value = f.value || '';
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.min !== '' && f.min !== undefined && type === 'number') input.min = String(f.min);
      if (f.max !== '' && f.max !== undefined && type === 'number') input.max = String(f.max);
      if (f.step !== '' && f.step !== undefined && type === 'number') input.step = String(f.step);
      if (f.maxLength > 0) input.maxLength = f.maxLength;
      get = () => input.value;
      wrap.appendChild(input);
    }
    if (type !== 'radio') input.disabled = !!f.disabled;

    if (f.hint) {
      const h = document.createElement('div');
      h.textContent = f.hint;
      Object.assign(h.style, { fontSize: '12px', color: c.muted, marginTop: '4px' });
      wrap.appendChild(h);
    }
    const err = document.createElement('div');
    Object.assign(err.style, { fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'none' });
    wrap.appendChild(err);

    const validate = () => {
      const v = get();
      const s = typeof v === 'boolean' ? v : String(v).trim();
      const custom = f.errorMessage;
      let msg = '';
      if (f.required && (type === 'checkbox' ? !v : s === '')) {
        msg = custom || (type === 'checkbox' ? 'This must be checked' : 'This field is required');
      } else if (typeof s === 'string' && s !== '') {
        if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
          msg = custom || 'Enter a valid email';
        } else if (type === 'url' && !/^https?:\/\/\S+$/i.test(s)) {
          msg = custom || 'Enter a valid URL (https://...)';
        } else if (type === 'number' || type === 'range') {
          const n = Number(s);
          if (!isFinite(n)) msg = custom || 'Enter a valid number';
          else if (f.min !== '' && f.min !== undefined && n < Number(f.min))
            msg = custom || `Must be at least ${f.min}`;
          else if (f.max !== '' && f.max !== undefined && n > Number(f.max))
            msg = custom || `Must be at most ${f.max}`;
        } else if (f.minLength > 0 && s.length < f.minLength) {
          msg = custom || `Use at least ${f.minLength} characters`;
        } else if (f.maxLength > 0 && s.length > f.maxLength) {
          msg = custom || `Use at most ${f.maxLength} characters`;
        } else if (f.pattern) {
          try {
            if (!new RegExp(`^(?:${f.pattern})$`).test(s)) msg = custom || 'Invalid format';
          } catch (e) {}
        }
      }
      err.textContent = msg;
      err.style.display = msg ? 'block' : 'none';
      if (TEXTLIKE.includes(input.type) || type === 'textarea' || type === 'select') {
        input.style.borderColor = msg ? '#ef4444' : c.border;
      }
      return msg === '';
    };
    wrap.addEventListener('input', () => {
      if (err.textContent) validate();
    });

    const typed = () => {
      const v = get();
      if (type === 'number' || type === 'range') return String(v).trim() === '' ? '' : Number(v);
      return v;
    };
    return { name: f.name, wrap, input, validate, value: typed };
  };

  const showModal = ({ title, message, fields, input, defaultValue, options, buttons, icon }) =>
    new Promise((resolve) => {
      const ds = dialogStyle;
      const c = dialogColors();
      const container = getContainer();
      const anim = ds.animation;
      const cardFrom = anim === 'zoom' ? 'scale(.92)' : anim === 'slide' ? 'translateY(24px)' : 'none';

      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: positionMode(container),
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '100000',
        fontFamily: ds.fontFamily,
        padding: '16px',
        boxSizing: 'border-box',
        background: rgba(ds.overlayColor || '#000000', ds.overlayOpacity / 100),
        backdropFilter: ds.blur > 0 ? `blur(${ds.blur}px)` : '',
        opacity: anim === 'none' ? '1' : '0',
        transition: anim === 'none' ? 'none' : 'opacity .18s'
      });

      const card = document.createElement('div');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      Object.assign(card.style, {
        position: 'relative',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: `${ds.radius}px`,
        padding: `${ds.padding}px`,
        width: '100%',
        maxWidth: `${ds.width}px`,
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        textAlign: ds.textAlign,
        boxShadow: ds.shadow ? '0 20px 50px rgba(0,0,0,.4)' : 'none',
        colorScheme: c.dark ? 'dark' : 'light',
        opacity: anim === 'none' ? '1' : '0',
        transform: cardFrom,
        transition: anim === 'none' ? 'none' : 'transform .2s ease, opacity .2s'
      });

      const effIcon = icon !== undefined ? icon : ds.icon;
      if (effIcon) {
        const ic = document.createElement('div');
        ic.textContent = effIcon;
        Object.assign(ic.style, { fontSize: '34px', lineHeight: '1', marginBottom: '10px' });
        card.appendChild(ic);
      }
      const effTitle = title || ds.defaultTitle;
      if (effTitle) {
        const h = document.createElement('div');
        h.textContent = effTitle;
        Object.assign(h.style, {
          fontSize: `${ds.titleSize}px`,
          fontWeight: '700',
          marginBottom: '8px',
          paddingRight: ds.showClose ? '24px' : '0'
        });
        card.appendChild(h);
      }
      if (message) {
        const m = document.createElement('div');
        m.textContent = message;
        Object.assign(m.style, {
          fontSize: `${ds.messageSize}px`,
          lineHeight: '1.5',
          color: c.muted,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginBottom: '14px'
        });
        card.appendChild(m);
      }

      let specs = fields ? fields.slice() : [];
      if (options) specs = [{ name: '_', type: 'select', options, value: '' }];
      else if (input) specs = [{ name: '_', type: 'text', value: defaultValue || '' }];
      const refs = specs.map((f) => buildField(f, c));
      refs.forEach((r) => card.appendChild(r.wrap));

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginTop: '4px',
        justifyContent:
          ds.buttonAlign === 'left' ? 'flex-start' : ds.buttonAlign === 'center' ? 'center' : 'flex-end'
      });
      card.appendChild(row);

      let primaryBtn = null;
      let closed = false;
      const cancelNow = () => close('', true);

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelNow();
          return;
        }
        const a = document.activeElement;
        if (
          e.key === 'Enter' &&
          primaryBtn &&
          a &&
          a.tagName === 'INPUT' &&
          overlay.contains(a) &&
          !['checkbox', 'radio', 'button', 'color', 'range'].includes(a.type)
        ) {
          e.preventDefault();
          e.stopPropagation();
          primaryBtn.click();
        }
      };

      function close(value, cancelled) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        modalClosers.delete(cancelNow);
        const values = Object.create(null);
        refs.forEach((r) => {
          values[r.name] = r.value();
        });
        const text = refs.length ? String(refs[0].value()) : '';
        overlay.style.pointerEvents = 'none';
        if (anim === 'none') {
          overlay.remove();
        } else {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 180);
        }
        resolve({ value, cancelled, text, values });
      }

      buttons.forEach((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = b.label;
        const prim = !!b.primary;
        let look;
        if (prim) {
          if (ds.buttonStyle === 'outline') {
            look = { background: 'transparent', color: c.primary, border: `1px solid ${c.primary}` };
          } else if (ds.buttonStyle === 'soft') {
            look = { background: rgba(c.primary, 0.18), color: c.primary, border: '1px solid transparent' };
          } else {
            look = { background: c.primary, color: contrastOn(c.primary), border: `1px solid ${c.primary}` };
          }
        } else if (ds.buttonStyle === 'soft') {
          look = { background: rgba(c.fg, 0.08), color: c.fg, border: '1px solid transparent' };
        } else {
          look = { background: 'transparent', color: c.fg, border: `1px solid ${c.border}` };
        }
        Object.assign(
          btn.style,
          {
            padding: '8px 16px',
            borderRadius: `${ds.buttonRadius}px`,
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'inherit'
          },
          look
        );
        if (ds.buttonAlign === 'stretch') btn.style.flex = '1 1 0';
        btn.addEventListener('click', () => {
          if (!b.cancel && refs.length && b.validate !== false) {
            let first = null;
            refs.forEach((r) => {
              if (!r.validate() && !first) first = r;
            });
            if (first) {
              if (first.input && first.input.focus) first.input.focus();
              return;
            }
          }
          close(b.label, !!b.cancel);
        });
        if (prim) primaryBtn = btn;
        row.appendChild(btn);
      });

      if (ds.showClose) {
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '✕';
        x.setAttribute('aria-label', 'Close');
        Object.assign(x.style, {
          position: 'absolute',
          top: '8px',
          right: '8px',
          border: 'none',
          background: 'transparent',
          color: c.muted,
          cursor: 'pointer',
          fontSize: '16px',
          padding: '4px 8px'
        });
        x.addEventListener('click', cancelNow);
        card.appendChild(x);
      }

      let downOnOverlay = false;
      overlay.addEventListener('mousedown', (e) => {
        downOnOverlay = e.target === overlay;
      });
      overlay.addEventListener('click', (e) => {
        if (ds.closeOnOverlay && downOnOverlay && e.target === overlay) cancelNow();
      });

      overlay.appendChild(card);
      container.appendChild(overlay);
      document.addEventListener('keydown', onKey, true);
      modalClosers.add(cancelNow);
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        card.style.opacity = '1';
        card.style.transform = 'none';
      });
      setTimeout(() => {
        const target = (refs[0] && refs[0].input) || primaryBtn;
        if (target && target.focus) target.focus();
      }, 30);
    });

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const parseJsonSafe = (text) => {
    try {
      return { ok: true, value: JSON.parse(Cast.toString(text)) };
    } catch (e) {
      return { ok: false, value: undefined };
    }
  };

  const COLORS = {
    dialog: ['#6366f1', '#4f46e5', '#4338ca']
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
    fn.call(console, `[App Dialogs] ${text}`);
  };

  runtime.appUtilsDialogs = { showModal, style: dialogStyle };

  runtime.on('PROJECT_STOP_ALL', () => {
    Array.from(modalClosers).forEach((fn) => fn());
  });

  class AppDialogs {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Dialogs',
        color1: '#6366f1',
        color2: '#4f46e5',
        color3: '#4338ca',
        blocks: [
          label('Dialogs'),
          B('dialog', {
            opcode: 'alertDialog',
            blockType: BT.COMMAND,
            text: 'alert [TEXT] and wait',
            arguments: { TEXT: str('Hello!') }
          }),
          B('dialog', {
            opcode: 'confirmDialog',
            blockType: BT.BOOLEAN,
            text: 'user confirms [TEXT]?',
            arguments: { TEXT: str('Do you want to continue?') }
          }),
          B('dialog', {
            opcode: 'askText',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask [TEXT] default [DEFAULT]',
            arguments: { TEXT: str('What is your name?'), DEFAULT: str('') }
          }),
          B('dialog', {
            opcode: 'askLong',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask long text [TEXT] default [DEFAULT]',
            arguments: { TEXT: str('Write your feedback'), DEFAULT: str('') }
          }),
          B('dialog', {
            opcode: 'askNumber',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask number [TEXT] slider from [MIN] to [MAX] default [DEFAULT]',
            arguments: { TEXT: str('Pick your volume'), MIN: num(0), MAX: num(100), DEFAULT: num(50) }
          }),
          B('dialog', {
            opcode: 'askColor',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask color [TEXT] default [DEFAULT]',
            arguments: { TEXT: str('Pick a color'), DEFAULT: color('#8b5cf6') }
          }),
          B('dialog', {
            opcode: 'askDate',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask [KIND] [TEXT]',
            arguments: { KIND: str('date', 'dateInputKinds'), TEXT: str('When is the event?') }
          }),
          B('dialog', {
            opcode: 'selectDialog',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask [TEXT] choose from [OPTIONS]',
            arguments: { TEXT: str('Pick a fruit'), OPTIONS: str('Apple,Banana,Orange') }
          }),
          B('dialog', {
            opcode: 'choiceDialog',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'dialog [TITLE] [MESSAGE] buttons [BUTTONS]',
            arguments: {
              TITLE: str('Leave app'),
              MESSAGE: str('Save before leaving?'),
              BUTTONS: str('Save,Discard,Cancel')
            }
          }),
          B('dialog', {
            opcode: 'askCancelled',
            blockType: BT.BOOLEAN,
            text: 'last question was cancelled?'
          }),

          label('Dialog style'),
          B('dialog', {
            opcode: 'setDialogProp',
            blockType: BT.COMMAND,
            text: 'set dialog [PROP] to [VALUE]',
            arguments: { PROP: str('background', 'dialogProps'), VALUE: str('#111827') }
          }),
          B('dialog', {
            opcode: 'setDialogAnimation',
            blockType: BT.COMMAND,
            text: 'set dialog animation to [ANIM]',
            arguments: { ANIM: str('zoom', 'dialogAnimations') }
          }),
          B('dialog', {
            opcode: 'setDialogButtons',
            blockType: BT.COMMAND,
            text: 'set dialog buttons style [STYLE] aligned [ALIGN]',
            arguments: { STYLE: str('filled', 'buttonStyles'), ALIGN: str('right', 'buttonAligns') }
          }),
          B('dialog', {
            opcode: 'setDialogOption',
            blockType: BT.COMMAND,
            text: 'dialog [OPTION]: [STATE]',
            arguments: { OPTION: str('closeOnOverlay', 'dialogOptions'), STATE: str('on', 'onOff') }
          }),
          B('dialog', {
            opcode: 'dialogStyleJson',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'dialog style as JSON object'
          }),
          B('dialog', {
            opcode: 'setDialogStyleJson',
            blockType: BT.COMMAND,
            text: 'set dialog style from JSON [JSON]',
            arguments: { JSON: str('{"radius":24,"buttonStyle":"soft","buttonAlign":"stretch","icon":"✨"}') }
          }),
          B('dialog', { opcode: 'resetDialogStyle', blockType: BT.COMMAND, text: 'reset dialog style' }),
          B('dialog', {
            opcode: 'applyPreset',
            blockType: BT.COMMAND,
            text: 'apply style preset [PRESET] to dialogs',
            arguments: { PRESET: str('glass', 'stylePresets') }
          }),
          B('dialog', {
            opcode: 'setDialogTheme',
            blockType: BT.COMMAND,
            text: 'set dialog theme to [THEME]',
            arguments: { THEME: str('auto', 'themes') }
          }),
          B('dialog', { opcode: 'dialogThemeIsDark', blockType: BT.BOOLEAN, text: 'dialog theme is dark?' })
        ],
        menus: {
          dialogProps: items(
            pairs([
              ['background color', 'background'],
              ['text color', 'color'],
              ['border color', 'border'],
              ['message color', 'mutedColor'],
              ['input background', 'inputBackground'],
              ['button color', 'primaryColor'],
              ['overlay color', 'overlayColor'],
              ['overlay opacity (%)', 'overlayOpacity'],
              ['overlay blur', 'blur'],
              ['corner radius', 'radius'],
              ['width', 'width'],
              ['padding', 'padding'],
              ['title size', 'titleSize'],
              ['message size', 'messageSize'],
              ['font family', 'fontFamily'],
              ['text alignment', 'textAlign'],
              ['button corner radius', 'buttonRadius'],
              ['icon / emoji', 'icon'],
              ['default title', 'defaultTitle'],
              ['OK button text', 'okLabel'],
              ['Cancel button text', 'cancelLabel']
            ])
          ),
          dialogAnimations: items(
            pairs([
              ['zoom', 'zoom'],
              ['slide', 'slide'],
              ['fade', 'fade'],
              ['none', 'none']
            ])
          ),
          buttonStyles: items(
            pairs([
              ['filled', 'filled'],
              ['outline', 'outline'],
              ['soft', 'soft']
            ])
          ),
          buttonAligns: items(
            pairs([
              ['left', 'left'],
              ['center', 'center'],
              ['right', 'right'],
              ['stretch', 'stretch']
            ])
          ),
          dialogOptions: items(
            pairs([
              ['close when clicking outside', 'closeOnOverlay'],
              ['close (X) button', 'showClose'],
              ['shadow', 'shadow']
            ])
          ),
          stylePresets: items(
            pairs(
              ['default', 'light', 'dark', 'glass', 'neon', 'minimal', 'pill', 'retro'].map((x) => [x, x])
            )
          ),
          dateInputKinds: items(
            pairs([
              ['date', 'date'],
              ['time', 'time'],
              ['date & time', 'datetime-local']
            ])
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

    async alertDialog({ TEXT }) {
      await showModal({
        title: '',
        message: Cast.toString(TEXT),
        buttons: [{ label: dialogStyle.okLabel || 'OK', primary: true }]
      });
    }

    async confirmDialog({ TEXT }) {
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      return !r.cancelled;
    }

    async askText({ TEXT, DEFAULT }) {
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        input: true,
        defaultValue: Cast.toString(DEFAULT),
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : r.text;
    }

    async askLong({ TEXT, DEFAULT }) {
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        fields: [{ name: 'text', type: 'textarea', value: Cast.toString(DEFAULT) }],
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : r.text;
    }

    async askNumber({ TEXT, MIN, MAX, DEFAULT }) {
      const a = Cast.toNumber(MIN);
      const b = Cast.toNumber(MAX);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        fields: [
          {
            name: 'n',
            type: 'range',
            min: lo,
            max: hi,
            step: Number.isInteger(lo) && Number.isInteger(hi) ? 1 : 'any',
            value: clamp(Cast.toNumber(DEFAULT), lo, hi)
          }
        ],
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : Number(r.text);
    }

    async askColor({ TEXT, DEFAULT }) {
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        fields: [{ name: 'c', type: 'color', value: Cast.toString(DEFAULT) }],
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : r.text;
    }

    async askDate({ KIND, TEXT }) {
      const kind = ['date', 'time', 'datetime-local'].includes(Cast.toString(KIND))
        ? Cast.toString(KIND)
        : 'date';
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        fields: [{ name: 'd', type: kind, value: '' }],
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : r.text;
    }

    async selectDialog({ TEXT, OPTIONS }) {
      const options = parseList(OPTIONS);
      if (options.length === 0) {
        state.lastAskCancelled = true;
        return '';
      }
      const r = await showModal({
        title: '',
        message: Cast.toString(TEXT),
        options,
        buttons: [
          { label: dialogStyle.cancelLabel || 'Cancel', cancel: true },
          { label: dialogStyle.okLabel || 'OK', primary: true }
        ]
      });
      state.lastAskCancelled = r.cancelled;
      return r.cancelled ? '' : r.text;
    }

    async choiceDialog({ TITLE, MESSAGE, BUTTONS }) {
      const labels = parseList(BUTTONS);
      if (labels.length === 0) labels.push(dialogStyle.okLabel || 'OK');
      const r = await showModal({
        title: Cast.toString(TITLE),
        message: Cast.toString(MESSAGE),
        buttons: labels.map((l, i) => ({ label: l, primary: i === 0 }))
      });
      state.lastAskCancelled = r.cancelled;
      return r.value;
    }

    askCancelled() {
      return state.lastAskCancelled;
    }

    setDialogProp({ PROP, VALUE }) {
      applyProp(dialogStyle, DIALOG_SCHEMA, Cast.toString(PROP), VALUE);
    }

    setDialogAnimation({ ANIM }) {
      applyProp(dialogStyle, DIALOG_SCHEMA, 'animation', ANIM);
    }

    setDialogButtons({ STYLE, ALIGN }) {
      applyProp(dialogStyle, DIALOG_SCHEMA, 'buttonStyle', STYLE);
      applyProp(dialogStyle, DIALOG_SCHEMA, 'buttonAlign', ALIGN);
    }

    setDialogOption({ OPTION, STATE }) {
      const key = Cast.toString(OPTION);
      const def = DIALOG_SCHEMA[key];
      if (def && def[0] === 'bool') applyProp(dialogStyle, DIALOG_SCHEMA, key, STATE);
    }

    dialogStyleJson() {
      return JSON.stringify(dialogStyle);
    }

    setDialogStyleJson({ JSON: json }) {
      if (!importStyle(dialogStyle, DIALOG_SCHEMA, json)) {
        addLog('set dialog style: expected a JSON object', 'error', 'style');
      }
    }

    resetDialogStyle() {
      resetStyle(dialogStyle, DIALOG_DEFAULTS);
    }

    applyPreset({ PRESET }) {
      applyPreset(Cast.toString(PRESET));
    }

    setDialogTheme({ THEME }) {
      const t = Cast.toString(THEME);
      state.theme = t === 'light' || t === 'dark' ? t : 'auto';
    }

    dialogThemeIsDark() {
      return isDark();
    }
  }

  Scratch.extensions.register(new AppDialogs());
})(Scratch);
