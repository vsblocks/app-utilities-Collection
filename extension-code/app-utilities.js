// Name: App Utilities
// ID: apputilities
// Description: Text, math, color, date and validation utilities.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Utilities must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'apputilities';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const toDate = (v) => {
    const s = Cast.toString(v).trim();
    if (s === '') return new Date();
    return /^-?\d+(\.\d+)?$/.test(s) ? new Date(Number(s)) : new Date(s);
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

  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

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

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const parsePath = (path) =>
    Cast.toString(path)
      .replace(/\[(\w+)\]/g, '.$1')
      .split('.')
      .filter((s) => s !== '');

  const jsonGet = (root, parts) => {
    let cur = root;
    for (const p of parts) {
      if (
        cur === null ||
        typeof cur !== 'object' ||
        FORBIDDEN_KEYS.has(p) ||
        !Object.prototype.hasOwnProperty.call(cur, p)
      ) {
        return undefined;
      }
      cur = cur[p];
    }
    return cur;
  };

  const parseJsonSafe = (text) => {
    try {
      return { ok: true, value: JSON.parse(Cast.toString(text)) };
    } catch (e) {
      return { ok: false, value: undefined };
    }
  };

  const EASINGS = {
    linear: (t) => t,
    easeIn: (t) => t * t,
    easeOut: (t) => t * (2 - t),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    cubicIn: (t) => t * t * t,
    cubicOut: (t) => 1 - Math.pow(1 - t, 3),
    cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    backOut: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    bounceOut: (t) => {
      const n = 7.5625;
      const d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
    elasticOut: (t) =>
      t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1
  };

  const hash32 = (s) => {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };

  const rand01 = (key) => {
    const a = (hash32(key) + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const randInt = (n) => {
    if (window.crypto && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      const lim = Math.floor(4294967296 / n) * n;
      let x;
      do {
        crypto.getRandomValues(arr);
        x = arr[0];
      } while (x >= lim);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  };

  const rgbToHsl = ([r, g, b]) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  };

  const hslToRgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };

  const relLuminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const anyColorRgb = (c) => parseHex(colorToHex(c) || '');

  const LOREM = (
    'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et ' +
    'dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea ' +
    'commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur'
  ).split(' ');

  const COLORS = {
    utils: ['#84cc16', '#65a30d', '#4d7c0f']
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

  class AppUtilities {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Utilities',
        color1: '#84cc16',
        color2: '#65a30d',
        color3: '#4d7c0f',
        blocks: [
          label('Utilities'),
          B('utils', {
            opcode: 'uuid',
            blockType: BT.REPORTER,
            blockShape: SH.SCRAPPED,
            text: 'unique ID'
          }),
          B('utils', {
            opcode: 'randomId',
            blockType: BT.REPORTER,
            blockShape: SH.SCRAPPED,
            text: 'random ID of length [LENGTH]',
            arguments: { LENGTH: num(8) }
          }),
          '---',
          B('utils', {
            opcode: 'timestamp',
            blockType: BT.REPORTER,
            blockShape: SH.TICKET,
            text: 'now (timestamp ms)'
          }),
          B('utils', {
            opcode: 'parseDate',
            blockType: BT.REPORTER,
            blockShape: SH.TICKET,
            text: 'timestamp of date text [TEXT]',
            arguments: { TEXT: str('2026-12-25 18:30') }
          }),
          B('utils', {
            opcode: 'formatDate',
            blockType: BT.REPORTER,
            text: 'format date [TIME] as [STYLE]',
            arguments: { TIME: str(''), STYLE: str('datetime', 'dateStyles') }
          }),
          B('utils', {
            opcode: 'relativeTime',
            blockType: BT.REPORTER,
            text: 'relative time of [TIME]',
            arguments: { TIME: str('') }
          }),
          B('utils', {
            opcode: 'addToDate',
            blockType: BT.REPORTER,
            blockShape: SH.TICKET,
            text: 'add [N] [UNIT] to date [TIME]',
            arguments: { N: num(7), UNIT: str('days', 'dateUnits'), TIME: str('') }
          }),
          B('utils', {
            opcode: 'datePart',
            blockType: BT.REPORTER,
            text: '[PART] of date [TIME]',
            arguments: { PART: str('year', 'dateParts'), TIME: str('') }
          }),
          B('utils', {
            opcode: 'daysBetween',
            blockType: BT.REPORTER,
            text: 'whole days from [A] to [B]',
            arguments: { A: str(''), B: str('2026-12-25') }
          }),
          '---',
          B('utils', {
            opcode: 'formatNumber',
            blockType: BT.REPORTER,
            blockShape: SH.BUMPED,
            text: 'format number [N] as [STYLE] with [DECIMALS] decimals',
            arguments: { N: num(1234567.891), STYLE: str('number', 'numberStyles'), DECIMALS: num(2) }
          }),
          B('utils', {
            opcode: 'formatCurrency',
            blockType: BT.REPORTER,
            blockShape: SH.BUMPED,
            text: 'format [N] as currency [CODE]',
            arguments: { N: num(49.9), CODE: str('USD') }
          }),
          B('utils', {
            opcode: 'formatBytes',
            blockType: BT.REPORTER,
            blockShape: SH.BUMPED,
            text: 'format [N] bytes as size',
            arguments: { N: num(1536000) }
          }),
          B('utils', {
            opcode: 'formatDuration',
            blockType: BT.REPORTER,
            blockShape: SH.BUMPED,
            text: 'format [SECS] seconds as [STYLE]',
            arguments: { SECS: num(3723), STYLE: str('clock', 'durationStyles') }
          }),
          B('utils', {
            opcode: 'clampNumber',
            blockType: BT.REPORTER,
            text: 'clamp [N] between [MIN] and [MAX]',
            arguments: { N: num(150), MIN: num(0), MAX: num(100) }
          }),
          B('utils', {
            opcode: 'mapRange',
            blockType: BT.REPORTER,
            text: 'map [N] from [A1]-[B1] to [A2]-[B2]',
            arguments: { N: num(5), A1: num(0), B1: num(10), A2: num(0), B2: num(100) }
          }),
          '---',
          B('utils', {
            opcode: 'base64Encode',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'Base64 encode [TEXT]',
            arguments: { TEXT: str('hello') }
          }),
          B('utils', {
            opcode: 'base64Decode',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'Base64 decode [TEXT]',
            arguments: { TEXT: str('aGVsbG8=') }
          }),
          B('utils', {
            opcode: 'urlEncode',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'URL encode [TEXT]',
            arguments: { TEXT: str('coffee & milk') }
          }),
          B('utils', {
            opcode: 'urlDecode',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'URL decode [TEXT]',
            arguments: { TEXT: str('coffee%20%26%20milk') }
          }),
          B('utils', {
            opcode: 'slugify',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'slugify [TEXT]',
            arguments: { TEXT: str('My First Blog Post!') }
          }),
          B('utils', {
            opcode: 'titleCase',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'title case [TEXT]',
            arguments: { TEXT: str('hello brave new world') }
          }),
          B('utils', {
            opcode: 'truncateText',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'truncate [TEXT] to [N] characters',
            arguments: { TEXT: str('A very long description that should be shortened'), N: num(20) }
          }),
          B('utils', {
            opcode: 'isValid',
            blockType: BT.BOOLEAN,
            text: '[TEXT] is a valid [KIND]?',
            arguments: { TEXT: str('user@example.com'), KIND: str('email', 'validKinds') }
          }),
          '---',
          B('utils', {
            opcode: 'jsonGet',
            blockType: BT.REPORTER,
            text: 'get [PATH] from JSON [JSON]',
            arguments: { PATH: str('user.items[0].name'), JSON: str('{"user":{"items":[{"name":"Ana"}]}}') }
          }),
          B('utils', {
            opcode: 'jsonSet',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'set [PATH] to [VALUE] in JSON [JSON]',
            arguments: { PATH: str('user.age'), VALUE: str('30'), JSON: str('{"user":{"name":"Ana"}}') }
          }),
          B('utils', {
            opcode: 'jsonKeys',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'keys of JSON [JSON]',
            arguments: { JSON: str('{"a":1,"b":2}') }
          }),
          '---',
          B('utils', {
            opcode: 'contrastColor',
            blockType: BT.REPORTER,
            text: 'readable text color on [COLOR]',
            arguments: { COLOR: color('#8b5cf6') }
          }),
          B('utils', {
            opcode: 'mixColors',
            blockType: BT.REPORTER,
            text: 'mix [A] with [B] by [PERCENT]%',
            arguments: { A: color('#8b5cf6'), B: color('#ffffff'), PERCENT: num(50) }
          }),
          B('utils', {
            opcode: 'adjustBrightness',
            blockType: BT.REPORTER,
            text: 'adjust [COLOR] brightness by [PERCENT]%',
            arguments: { COLOR: color('#8b5cf6'), PERCENT: num(20) }
          }),
          label('Text, Math & Color tools'),
          B('utils', {
            opcode: 'generatePassword',
            blockType: BT.REPORTER,
            blockShape: SH.SCRAPPED,
            text: 'generate [SET] password of length [LENGTH]',
            arguments: { SET: str('full', 'passwordSets'), LENGTH: num(16) }
          }),
          B('utils', {
            opcode: 'passwordStrength',
            blockType: BT.REPORTER,
            text: 'strength of password [TEXT] (0-100)',
            arguments: { TEXT: str('correct-horse-battery') }
          }),
          B('utils', {
            opcode: 'loremIpsum',
            blockType: BT.REPORTER,
            text: 'placeholder text with [N] words',
            arguments: { N: num(12) }
          }),
          '---',
          B('utils', {
            opcode: 'wordCount',
            blockType: BT.REPORTER,
            text: 'word count of [TEXT]',
            arguments: { TEXT: str('The quick brown fox') }
          }),
          B('utils', {
            opcode: 'readingTime',
            blockType: BT.REPORTER,
            text: 'reading time of [TEXT] (minutes)',
            arguments: { TEXT: str('The quick brown fox') }
          }),
          B('utils', {
            opcode: 'countOccurrences',
            blockType: BT.REPORTER,
            text: 'how many times [SUB] appears in [TEXT]',
            arguments: { SUB: str('a'), TEXT: str('banana') }
          }),
          B('utils', {
            opcode: 'convertCase',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'convert [TEXT] to [CASE]',
            arguments: { TEXT: str('hello brave new world'), CASE: str('camel', 'caseStyles') }
          }),
          B('utils', {
            opcode: 'maskText',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'mask [TEXT] keeping last [N] characters',
            arguments: { TEXT: str('4111111111111111'), N: num(4) }
          }),
          B('utils', {
            opcode: 'initialsOf',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'initials of [TEXT] (max [N])',
            arguments: { TEXT: str('John Ronald Smith'), N: num(2) }
          }),
          B('utils', {
            opcode: 'removeAccents',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'remove accents from [TEXT]',
            arguments: { TEXT: str('café crème brûlée') }
          }),
          B('utils', {
            opcode: 'extractNumbers',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'numbers found in [TEXT] as JSON list',
            arguments: { TEXT: str('Total: 12 items, 3.5 kg') }
          }),
          '---',
          B('utils', {
            opcode: 'easeValue',
            blockType: BT.REPORTER,
            text: 'ease [T]% from [A] to [B] using [EASE]',
            arguments: { T: num(50), A: num(0), B: num(100), EASE: str('cubicOut', 'easings') }
          }),
          B('utils', {
            opcode: 'seededRandom',
            blockType: BT.REPORTER,
            text: 'seeded random [SEED] #[INDEX] from [MIN] to [MAX]',
            arguments: { SEED: str('level-1'), INDEX: num(1), MIN: num(1), MAX: num(10) }
          }),
          B('utils', {
            opcode: 'roundTo',
            blockType: BT.REPORTER,
            text: 'round [N] to nearest [STEP]',
            arguments: { N: num(37), STEP: num(5) }
          }),
          B('utils', {
            opcode: 'percentChange',
            blockType: BT.REPORTER,
            text: 'percent change from [A] to [B]',
            arguments: { A: num(80), B: num(100) }
          }),
          B('utils', {
            opcode: 'toRoman',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'roman numeral of [N]',
            arguments: { N: num(2026) }
          }),
          B('utils', {
            opcode: 'toOrdinal',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'ordinal of [N]',
            arguments: { N: num(23) }
          }),
          '---',
          B('utils', {
            opcode: 'colorPart',
            blockType: BT.REPORTER,
            text: '[PART] of color [COLOR]',
            arguments: { PART: str('hue', 'colorParts'), COLOR: color('#8b5cf6') }
          }),
          B('utils', {
            opcode: 'colorFromHsl',
            blockType: BT.REPORTER,
            text: 'color from hue [H] saturation [S] lightness [L]',
            arguments: { H: num(260), S: num(90), L: num(66) }
          }),
          B('utils', {
            opcode: 'colorPalette',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: '[SCHEME] palette of [COLOR] as JSON list',
            arguments: { SCHEME: str('analogous', 'paletteSchemes'), COLOR: color('#8b5cf6') }
          }),
          B('utils', {
            opcode: 'contrastRatio',
            blockType: BT.REPORTER,
            text: 'contrast ratio of [A] and [B]',
            arguments: { A: color('#8b5cf6'), B: color('#ffffff') }
          })
        ],
        menus: {
          caseStyles: items(
            pairs([
              ['camelCase', 'camel'],
              ['PascalCase', 'pascal'],
              ['snake_case', 'snake'],
              ['kebab-case', 'kebab'],
              ['CONSTANT_CASE', 'constant'],
              ['Sentence case', 'sentence'],
              ['aLtErNaTiNg', 'alternate']
            ])
          ),
          passwordSets: items(
            pairs([
              ['letters, numbers & symbols', 'full'],
              ['letters & numbers', 'alnum'],
              ['letters only', 'letters'],
              ['numbers only (PIN)', 'digits']
            ])
          ),
          easings: items(
            pairs([
              ['linear', 'linear'],
              ['ease in', 'easeIn'],
              ['ease out', 'easeOut'],
              ['ease in-out', 'easeInOut'],
              ['cubic in', 'cubicIn'],
              ['cubic out', 'cubicOut'],
              ['cubic in-out', 'cubicInOut'],
              ['sine in-out', 'sineInOut'],
              ['back out', 'backOut'],
              ['bounce out', 'bounceOut'],
              ['elastic out', 'elasticOut']
            ])
          ),
          colorParts: items(
            pairs([
              ['red', 'red'],
              ['green', 'green'],
              ['blue', 'blue'],
              ['hue', 'hue'],
              ['saturation', 'saturation'],
              ['lightness', 'lightness']
            ])
          ),
          paletteSchemes: items(
            pairs(['analogous', 'complementary', 'triadic', 'tetradic', 'shades', 'tints'].map((x) => [x, x]))
          ),
          dateStyles: items(
            pairs([
              ['date & time', 'datetime'],
              ['short date', 'date'],
              ['long date', 'longdate'],
              ['time', 'time'],
              ['weekday name', 'weekday'],
              ['ISO 8601', 'iso']
            ])
          ),
          dateUnits: items(
            pairs(['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'].map((u) => [u, u]))
          ),
          dateParts: items(
            pairs([
              ['year', 'year'],
              ['month (1-12)', 'month'],
              ['day of month', 'day'],
              ['hour', 'hour'],
              ['minute', 'minute'],
              ['second', 'second'],
              ['weekday (1=Mon)', 'weekday']
            ])
          ),
          numberStyles: items(
            pairs([
              ['number', 'number'],
              ['compact (1.2M)', 'compact'],
              ['percent', 'percent']
            ])
          ),
          durationStyles: items(
            pairs([
              ['clock (1:02:03)', 'clock'],
              ['words (1h 2m 3s)', 'words']
            ])
          ),
          validKinds: items(
            pairs([
              ['email', 'email'],
              ['URL', 'url'],
              ['number', 'number'],
              ['integer', 'integer'],
              ['JSON', 'json'],
              ['hex color', 'hex'],
              ['IPv4 address', 'ipv4']
            ])
          )
        }
      };
    }

    uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }

    randomId({ LENGTH }) {
      const len = clamp(Math.floor(Cast.toNumber(LENGTH)), 1, 128);
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let out = '';
      if (window.crypto && crypto.getRandomValues) {
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        bytes.forEach((b) => {
          out += chars[b % chars.length];
        });
      } else {
        for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }

    timestamp() {
      return Date.now();
    }

    parseDate({ TEXT }) {
      const d = new Date(Cast.toString(TEXT));
      return isNaN(d.getTime()) ? '' : d.getTime();
    }

    formatDate({ TIME, STYLE }) {
      const d = toDate(TIME);
      if (isNaN(d.getTime())) return '';
      const lang = navigator.language || 'en-US';
      try {
        switch (Cast.toString(STYLE)) {
          case 'date':
            return d.toLocaleDateString(lang);
          case 'longdate':
            return d.toLocaleDateString(lang, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
          case 'time':
            return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
          case 'weekday':
            return d.toLocaleDateString(lang, { weekday: 'long' });
          case 'iso':
            return d.toISOString();
          default:
            return d.toLocaleString(lang);
        }
      } catch (e) {
        return '';
      }
    }

    relativeTime({ TIME }) {
      const d = toDate(TIME);
      if (isNaN(d.getTime())) return '';
      const diff = (d.getTime() - Date.now()) / 1000;
      const abs = Math.abs(diff);
      const units = [
        ['year', 31536000],
        ['month', 2592000],
        ['week', 604800],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
        ['second', 1]
      ];
      try {
        const rtf = new Intl.RelativeTimeFormat(navigator.language || 'en-US', { numeric: 'auto' });
        for (const [unit, secs] of units) {
          if (abs >= secs || unit === 'second') return rtf.format(Math.round(diff / secs), unit);
        }
      } catch (e) {}
      return '';
    }

    addToDate({ N, UNIT, TIME }) {
      const d = toDate(TIME);
      if (isNaN(d.getTime())) return '';
      const n = Cast.toNumber(N);
      const ms = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const unit = Cast.toString(UNIT);
      if (ms[unit]) d.setTime(d.getTime() + n * ms[unit]);
      else if (unit === 'months') d.setMonth(d.getMonth() + Math.trunc(n));
      else if (unit === 'years') d.setFullYear(d.getFullYear() + Math.trunc(n));
      return d.getTime();
    }

    datePart({ PART, TIME }) {
      const d = toDate(TIME);
      if (isNaN(d.getTime())) return '';
      switch (Cast.toString(PART)) {
        case 'year':
          return d.getFullYear();
        case 'month':
          return d.getMonth() + 1;
        case 'day':
          return d.getDate();
        case 'hour':
          return d.getHours();
        case 'minute':
          return d.getMinutes();
        case 'second':
          return d.getSeconds();
        case 'weekday':
          return ((d.getDay() + 6) % 7) + 1;
        default:
          return '';
      }
    }

    daysBetween({ A, B: b }) {
      const da = toDate(A);
      const db = toDate(b);
      if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
      return Math.trunc((db.getTime() - da.getTime()) / 86400000);
    }

    formatNumber({ N, STYLE, DECIMALS }) {
      const n = Cast.toNumber(N);
      const d = clamp(Math.floor(Cast.toNumber(DECIMALS)), 0, 20);
      const style = Cast.toString(STYLE);
      const opts = { minimumFractionDigits: d, maximumFractionDigits: d };
      if (style === 'compact') {
        opts.notation = 'compact';
        opts.minimumFractionDigits = 0;
      } else if (style === 'percent') {
        opts.style = 'percent';
      }
      try {
        return new Intl.NumberFormat(navigator.language || 'en-US', opts).format(n);
      } catch (e) {
        return String(n);
      }
    }

    formatCurrency({ N, CODE }) {
      const n = Cast.toNumber(N);
      try {
        return new Intl.NumberFormat(navigator.language || 'en-US', {
          style: 'currency',
          currency: Cast.toString(CODE).trim().toUpperCase() || 'USD'
        }).format(n);
      } catch (e) {
        return String(n);
      }
    }

    formatBytes({ N }) {
      let n = Math.max(0, Cast.toNumber(N));
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      const text = i === 0 ? String(Math.round(n)) : n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
      return `${text} ${units[i]}`;
    }

    formatDuration({ SECS, STYLE }) {
      const total = Math.max(0, Math.floor(Cast.toNumber(SECS)));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (x) => String(x).padStart(2, '0');
      if (Cast.toString(STYLE) === 'words') {
        const parts = [];
        if (h) parts.push(`${h}h`);
        if (m) parts.push(`${m}m`);
        if (s || parts.length === 0) parts.push(`${s}s`);
        return parts.join(' ');
      }
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    clampNumber({ N, MIN, MAX }) {
      const a = Cast.toNumber(MIN);
      const b = Cast.toNumber(MAX);
      return clamp(Cast.toNumber(N), Math.min(a, b), Math.max(a, b));
    }

    mapRange({ N, A1, B1, A2, B2 }) {
      const a1 = Cast.toNumber(A1);
      const b1 = Cast.toNumber(B1);
      if (a1 === b1) return Cast.toNumber(A2);
      const t = (Cast.toNumber(N) - a1) / (b1 - a1);
      return Cast.toNumber(A2) + t * (Cast.toNumber(B2) - Cast.toNumber(A2));
    }

    base64Encode({ TEXT }) {
      try {
        const bytes = new TextEncoder().encode(Cast.toString(TEXT));
        let bin = '';
        bytes.forEach((b) => {
          bin += String.fromCharCode(b);
        });
        return btoa(bin);
      } catch (e) {
        return '';
      }
    }

    base64Decode({ TEXT }) {
      try {
        const bin = atob(Cast.toString(TEXT).trim());
        return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
      } catch (e) {
        return '';
      }
    }

    urlEncode({ TEXT }) {
      return encodeURIComponent(Cast.toString(TEXT));
    }

    urlDecode({ TEXT }) {
      try {
        return decodeURIComponent(Cast.toString(TEXT));
      } catch (e) {
        return '';
      }
    }

    slugify({ TEXT }) {
      return Cast.toString(TEXT)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    titleCase({ TEXT }) {
      return Cast.toString(TEXT)
        .toLowerCase()
        .replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
    }

    truncateText({ TEXT, N }) {
      const s = Cast.toString(TEXT);
      const n = Math.max(1, Math.floor(Cast.toNumber(N)));
      return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`;
    }

    isValid({ TEXT, KIND }) {
      const s = Cast.toString(TEXT).trim();
      switch (Cast.toString(KIND)) {
        case 'email':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        case 'url':
          try {
            const u = new URL(s);
            return u.protocol === 'http:' || u.protocol === 'https:';
          } catch (e) {
            return false;
          }
        case 'number':
          return s !== '' && isFinite(Number(s));
        case 'integer':
          return /^-?\d+$/.test(s);
        case 'json':
          return parseJsonSafe(s).ok;
        case 'hex':
          return /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s);
        case 'ipv4':
          return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);
        default:
          return false;
      }
    }

    jsonGet({ PATH, JSON: json }) {
      const r = parseJsonSafe(json);
      if (!r.ok) return '';
      const v = jsonGet(r.value, parsePath(PATH));
      if (v === undefined) return '';
      return typeof v === 'object' ? JSON.stringify(v) : v;
    }

    jsonSet({ PATH, VALUE, JSON: json }) {
      const r = parseJsonSafe(json);
      const original = Cast.toString(json);
      if (!r.ok) return original;
      const parts = parsePath(PATH);
      if (parts.length === 0 || parts.some((p) => FORBIDDEN_KEYS.has(p))) return original;
      const parsed = parseJsonSafe(VALUE);
      const value = parsed.ok ? parsed.value : Cast.toString(VALUE);
      let root = r.value;
      if (root === null || typeof root !== 'object') root = /^\d+$/.test(parts[0]) ? [] : {};
      let cur = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (cur[p] === null || typeof cur[p] !== 'object') cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return JSON.stringify(root);
    }

    jsonKeys({ JSON: json }) {
      const r = parseJsonSafe(json);
      if (!r.ok || r.value === null || typeof r.value !== 'object') return '[]';
      return JSON.stringify(Object.keys(r.value));
    }

    contrastColor({ COLOR }) {
      const rgb = parseHex(COLOR);
      if (!rgb) return '#000000';
      return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 160 ? '#000000' : '#ffffff';
    }

    mixColors({ A, B: b, PERCENT }) {
      const ca = parseHex(A);
      const cb = parseHex(b);
      if (!ca || !cb) return Cast.toString(A);
      return toHex(mixRgb(ca, cb, clamp(Cast.toNumber(PERCENT), 0, 100) / 100));
    }

    adjustBrightness({ COLOR, PERCENT }) {
      const rgb = parseHex(COLOR);
      if (!rgb) return Cast.toString(COLOR);
      const p = clamp(Cast.toNumber(PERCENT), -100, 100) / 100;
      return toHex(mixRgb(rgb, p >= 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(p)));
    }

    generatePassword({ SET, LENGTH }) {
      const sets = {
        letters: 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
        alnum: 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        full: 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+?',
        digits: '0123456789'
      };
      const chars = sets[Cast.toString(SET)] || sets.full;
      const len = clamp(Math.floor(Cast.toNumber(LENGTH)), 4, 128);
      let out = '';
      for (let i = 0; i < len; i++) out += chars[randInt(chars.length)];
      return out;
    }

    passwordStrength({ TEXT }) {
      const s = Cast.toString(TEXT);
      if (!s) return 0;
      let score = Math.min(40, s.length * 4);
      const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(s)).length;
      score += classes * 10;
      if (s.length >= 12) score += 10;
      if (s.length >= 16) score += 10;
      if (/(.)\1{2,}/.test(s)) score -= 10;
      if (/^\d+$/.test(s)) score -= 15;
      if (/password|senha|qwerty|123456|abc123|admin/i.test(s)) score -= 30;
      return clamp(score, 0, 100);
    }

    loremIpsum({ N }) {
      const n = clamp(Math.floor(Cast.toNumber(N)), 1, 500);
      const words = [];
      for (let i = 0; i < n; i++) words.push(LOREM[randInt(LOREM.length)]);
      const text = words.join(' ');
      return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
    }

    wordCount({ TEXT }) {
      return Cast.toString(TEXT).trim().split(/\s+/).filter(Boolean).length;
    }

    readingTime({ TEXT }) {
      const words = Cast.toString(TEXT).trim().split(/\s+/).filter(Boolean).length;
      return Math.round((words / 200) * 10) / 10;
    }

    countOccurrences({ SUB, TEXT }) {
      const sub = Cast.toString(SUB);
      if (sub === '') return 0;
      return Cast.toString(TEXT).split(sub).length - 1;
    }

    convertCase({ TEXT, CASE }) {
      const raw = Cast.toString(TEXT);
      const words = raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9\u00C0-\u024F]+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase());
      const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
      switch (Cast.toString(CASE)) {
        case 'pascal':
          return words.map(cap).join('');
        case 'snake':
          return words.join('_');
        case 'kebab':
          return words.join('-');
        case 'constant':
          return words.join('_').toUpperCase();
        case 'sentence': {
          const t = words.join(' ');
          return t.charAt(0).toUpperCase() + t.slice(1);
        }
        case 'alternate':
          return Array.from(raw)
            .map((ch, i) => (i % 2 ? ch.toUpperCase() : ch.toLowerCase()))
            .join('');
        default:
          return words.map((w, i) => (i === 0 ? w : cap(w))).join('');
      }
    }

    maskText({ TEXT, N }) {
      const chars = Array.from(Cast.toString(TEXT));
      const keep = clamp(Math.floor(Cast.toNumber(N)), 0, chars.length);
      return chars.map((c, i) => (i >= chars.length - keep ? c : '*')).join('');
    }

    initialsOf({ TEXT, N }) {
      const max = clamp(Math.floor(Cast.toNumber(N)), 1, 10);
      return Cast.toString(TEXT)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map((w) => Array.from(w)[0].toUpperCase())
        .join('');
    }

    removeAccents({ TEXT }) {
      return Cast.toString(TEXT)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    extractNumbers({ TEXT }) {
      return JSON.stringify(
        (Cast.toString(TEXT).match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.')))
      );
    }

    easeValue({ T, A, B: b, EASE }) {
      const fn = EASINGS[Cast.toString(EASE)] || EASINGS.linear;
      const t = clamp(Cast.toNumber(T) / 100, 0, 1);
      const a = Cast.toNumber(A);
      return a + (Cast.toNumber(b) - a) * fn(t);
    }

    seededRandom({ SEED, INDEX, MIN, MAX }) {
      const lo = Math.min(Cast.toNumber(MIN), Cast.toNumber(MAX));
      const hi = Math.max(Cast.toNumber(MIN), Cast.toNumber(MAX));
      const r = rand01(`${Cast.toString(SEED)}#${Math.trunc(Cast.toNumber(INDEX))}`);
      if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(r * (hi - lo + 1));
      return lo + r * (hi - lo);
    }

    roundTo({ N, STEP }) {
      const step = Math.abs(Cast.toNumber(STEP));
      const n = Cast.toNumber(N);
      if (step === 0) return n;
      return Math.round(Math.round(n / step) * step * 1e10) / 1e10;
    }

    percentChange({ A, B: b }) {
      const a = Cast.toNumber(A);
      if (a === 0) return 0;
      return Math.round(((Cast.toNumber(b) - a) / Math.abs(a)) * 10000) / 100;
    }

    toRoman({ N }) {
      let n = Math.floor(Cast.toNumber(N));
      if (n < 1 || n > 3999) return '';
      const map = [
        [1000, 'M'],
        [900, 'CM'],
        [500, 'D'],
        [400, 'CD'],
        [100, 'C'],
        [90, 'XC'],
        [50, 'L'],
        [40, 'XL'],
        [10, 'X'],
        [9, 'IX'],
        [5, 'V'],
        [4, 'IV'],
        [1, 'I']
      ];
      let out = '';
      map.forEach(([v, s]) => {
        while (n >= v) {
          out += s;
          n -= v;
        }
      });
      return out;
    }

    toOrdinal({ N }) {
      const n = Math.trunc(Cast.toNumber(N));
      const abs = Math.abs(n);
      const mod100 = abs % 100;
      const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][abs % 10] || 'th';
      return `${n}${suffix}`;
    }

    colorPart({ PART, COLOR }) {
      const rgb = anyColorRgb(COLOR);
      if (!rgb) return 0;
      const part = Cast.toString(PART);
      if (part === 'red') return rgb[0];
      if (part === 'green') return rgb[1];
      if (part === 'blue') return rgb[2];
      const hsl = rgbToHsl(rgb);
      const i = part === 'hue' ? 0 : part === 'saturation' ? 1 : 2;
      return Math.round(hsl[i]);
    }

    colorFromHsl({ H, S, L }) {
      return toHex(hslToRgb(Cast.toNumber(H), Cast.toNumber(S), Cast.toNumber(L)));
    }

    colorPalette({ SCHEME, COLOR }) {
      const rgb = anyColorRgb(COLOR);
      if (!rgb) return '[]';
      const [h, s, l] = rgbToHsl(rgb);
      const at = (dh, dl) => toHex(hslToRgb(h + dh, s, clamp(l + (dl || 0), 0, 100)));
      let list;
      switch (Cast.toString(SCHEME)) {
        case 'complementary':
          list = [at(0), at(180)];
          break;
        case 'triadic':
          list = [at(0), at(120), at(240)];
          break;
        case 'tetradic':
          list = [at(0), at(90), at(180), at(270)];
          break;
        case 'shades':
          list = [0, 1, 2, 3, 4].map((i) => toHex(hslToRgb(h, s, l * (1 - i * 0.18))));
          break;
        case 'tints':
          list = [0, 1, 2, 3, 4].map((i) => toHex(hslToRgb(h, s, l + (100 - l) * i * 0.18)));
          break;
        default:
          list = [at(-30), at(0), at(30)];
      }
      return JSON.stringify(list);
    }

    contrastRatio({ A, B: b }) {
      const ca = anyColorRgb(A);
      const cb = anyColorRgb(b);
      if (!ca || !cb) return 0;
      const la = relLuminance(ca);
      const lb = relLuminance(cb);
      return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    }
  }

  Scratch.extensions.register(new AppUtilities());
})(Scratch);
