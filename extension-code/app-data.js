// Name: App Data
// ID: appdata
// Description: Lists, JSON, CSV and template tools.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Data must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appdata';

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

  const levenshtein = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };

  const toArray = (v) => {
    const s = Cast.toString(v).trim();
    if (s.startsWith('[')) {
      try {
        const a = JSON.parse(s);
        if (Array.isArray(a)) return a;
      } catch (e) {}
    }
    return s ? s.split(',').map((x) => x.trim()) : [];
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cur += '"';
            i++;
          } else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur);
        cur = '';
        rows.push(row);
        row = [];
      } else cur += ch;
    }
    if (cur !== '' || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
  };

  const csvCell = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const isPlainObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

  const deepMerge = (a, b) => {
    if (!isPlainObj(a) || !isPlainObj(b)) return b;
    const out = { ...a };
    Object.keys(b).forEach((k) => {
      if (FORBIDDEN_KEYS.has(k)) return;
      out[k] = Object.prototype.hasOwnProperty.call(out, k) ? deepMerge(out[k], b[k]) : b[k];
    });
    return out;
  };

  const COLORS = {
    data: ['#10b981', '#059669', '#047857']
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

  const items = (list) => ({ acceptReporters: true, items: list });

  const pairs = (list) => list.map(([text, value]) => ({ text, value }));

  class AppData {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Data',
        color1: '#10b981',
        color2: '#059669',
        color3: '#047857',
        blocks: [
          label('Lists & Data'),
          B('data', {
            opcode: 'listSort',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'sort list [LIST] [ORDER]',
            arguments: { LIST: str('["pear","apple","fig"]'), ORDER: str('az', 'listOrders') }
          }),
          B('data', {
            opcode: 'listUnique',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'unique items of list [LIST]',
            arguments: { LIST: str('[1,2,2,3,3,3]') }
          }),
          B('data', {
            opcode: 'listShuffle',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'shuffle list [LIST]',
            arguments: { LIST: str('[1,2,3,4,5]') }
          }),
          B('data', {
            opcode: 'listChunk',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'split list [LIST] into groups of [N]',
            arguments: { LIST: str('[1,2,3,4,5]'), N: num(2) }
          }),
          B('data', {
            opcode: 'listPick',
            blockType: BT.REPORTER,
            text: 'random item of list [LIST]',
            arguments: { LIST: str('["red","green","blue"]') }
          }),
          B('data', {
            opcode: 'listStat',
            blockType: BT.REPORTER,
            text: '[STAT] of numbers in list [LIST]',
            arguments: { STAT: str('average', 'listStats'), LIST: str('[4,8,15,16,23,42]') }
          }),
          B('data', {
            opcode: 'listJoin',
            blockType: BT.REPORTER,
            text: 'join list [LIST] with [SEP]',
            arguments: { LIST: str('["a","b","c"]'), SEP: str(' - ') }
          }),
          B('data', {
            opcode: 'textSplit',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'split text [TEXT] by [SEP] into JSON list',
            arguments: { TEXT: str('one;two;three'), SEP: str(';') }
          }),
          '---',
          B('data', {
            opcode: 'csvToJson',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'CSV [CSV] to JSON list of objects',
            arguments: { CSV: str('name,age\nAna,20\nBob,31') }
          }),
          B('data', {
            opcode: 'jsonToCsv',
            blockType: BT.REPORTER,
            text: 'JSON list of objects [JSON] to CSV',
            arguments: { JSON: str('[{"name":"Ana","age":20},{"name":"Bob","age":31}]') }
          }),
          B('data', {
            opcode: 'jsonMerge',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'merge JSON objects [A] and [B]',
            arguments: { A: str('{"a":1,"nested":{"x":1}}'), B: str('{"b":2,"nested":{"y":2}}') }
          }),
          B('data', {
            opcode: 'jsonDelete',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'delete [PATH] from JSON [JSON]',
            arguments: { PATH: str('user.age'), JSON: str('{"user":{"name":"Ana","age":30}}') }
          }),
          B('data', {
            opcode: 'fillTemplate',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'fill template [TEMPLATE] with JSON [JSON]',
            arguments: {
              TEMPLATE: str('Hello {user.name}, you have {count} messages'),
              JSON: str('{"user":{"name":"Ana"},"count":3}')
            }
          }),
          B('data', {
            opcode: 'similarity',
            blockType: BT.REPORTER,
            text: 'similarity of [A] and [B] (%)',
            arguments: { A: str('kitten'), B: str('sitting') }
          })
        ],
        menus: {
          listOrders: items(
            pairs([
              ['A → Z', 'az'],
              ['Z → A', 'za'],
              ['smallest first', 'asc'],
              ['largest first', 'desc'],
              ['shortest first', 'short'],
              ['longest first', 'long']
            ])
          ),
          listStats: items(pairs(['sum', 'average', 'min', 'max', 'median', 'count'].map((x) => [x, x])))
        }
      };
    }

    listSort({ LIST, ORDER }) {
      const a = toArray(LIST).slice();
      const num_ = (v) => Cast.toNumber(v);
      switch (Cast.toString(ORDER)) {
        case 'za':
          a.sort((x, y) =>
            String(y).localeCompare(String(x), undefined, { numeric: true, sensitivity: 'base' })
          );
          break;
        case 'asc':
          a.sort((x, y) => num_(x) - num_(y));
          break;
        case 'desc':
          a.sort((x, y) => num_(y) - num_(x));
          break;
        case 'short':
          a.sort((x, y) => String(x).length - String(y).length);
          break;
        case 'long':
          a.sort((x, y) => String(y).length - String(x).length);
          break;
        default:
          a.sort((x, y) =>
            String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })
          );
      }
      return JSON.stringify(a);
    }

    listUnique({ LIST }) {
      const seen = new Set();
      return JSON.stringify(
        toArray(LIST).filter((v) => {
          const k = typeof v === 'object' ? JSON.stringify(v) : `${typeof v}:${v}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
      );
    }

    listShuffle({ LIST }) {
      const a = toArray(LIST).slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return JSON.stringify(a);
    }

    listChunk({ LIST, N }) {
      const a = toArray(LIST);
      const n = Math.max(1, Math.floor(Cast.toNumber(N)));
      const out = [];
      for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
      return JSON.stringify(out);
    }

    listPick({ LIST }) {
      const a = toArray(LIST);
      if (a.length === 0) return '';
      const v = a[randInt(a.length)];
      return typeof v === 'object' ? JSON.stringify(v) : v;
    }

    listStat({ STAT, LIST }) {
      const nums = toArray(LIST)
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((v) => isFinite(v));
      const stat = Cast.toString(STAT);
      if (stat === 'count') return nums.length;
      if (nums.length === 0) return 0;
      const sum = nums.reduce((s, v) => s + v, 0);
      switch (stat) {
        case 'sum':
          return sum;
        case 'min':
          return Math.min(...nums);
        case 'max':
          return Math.max(...nums);
        case 'median': {
          const s = nums.slice().sort((x, y) => x - y);
          const mid = Math.floor(s.length / 2);
          return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
        }
        default:
          return sum / nums.length;
      }
    }

    listJoin({ LIST, SEP }) {
      return toArray(LIST)
        .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
        .join(Cast.toString(SEP));
    }

    textSplit({ TEXT, SEP }) {
      const sep = Cast.toString(SEP);
      const text = Cast.toString(TEXT);
      return JSON.stringify(sep === '' ? Array.from(text) : text.split(sep));
    }

    csvToJson({ CSV }) {
      const rows = parseCsv(Cast.toString(CSV));
      if (rows.length === 0) return '[]';
      const head = rows[0].map((h) => h.trim());
      return JSON.stringify(
        rows.slice(1).map((r) => {
          const o = {};
          head.forEach((h, i) => {
            if (h && !FORBIDDEN_KEYS.has(h)) o[h] = r[i] === undefined ? '' : r[i];
          });
          return o;
        })
      );
    }

    jsonToCsv({ JSON: json }) {
      const r = parseJsonSafe(json);
      if (!r.ok || !Array.isArray(r.value)) return '';
      const head = [];
      r.value.forEach((o) => {
        if (isPlainObj(o)) Object.keys(o).forEach((k) => head.includes(k) || head.push(k));
      });
      const lines = [head.map(csvCell).join(',')];
      r.value.forEach((o) => {
        lines.push(head.map((h) => csvCell(isPlainObj(o) ? o[h] : '')).join(','));
      });
      return lines.join('\n');
    }

    jsonMerge({ A, B: b }) {
      const ra = parseJsonSafe(A);
      const rb = parseJsonSafe(b);
      if (!ra.ok || !rb.ok) return ra.ok ? Cast.toString(A) : '{}';
      return JSON.stringify(deepMerge(ra.value, rb.value));
    }

    jsonDelete({ PATH, JSON: json }) {
      const r = parseJsonSafe(json);
      const original = Cast.toString(json);
      if (!r.ok) return original;
      const parts = parsePath(PATH);
      if (parts.length === 0 || parts.some((p) => FORBIDDEN_KEYS.has(p))) return original;
      const parent = parts.length === 1 ? r.value : jsonGet(r.value, parts.slice(0, -1));
      const last = parts[parts.length - 1];
      if (parent === null || typeof parent !== 'object') return original;
      if (Array.isArray(parent)) {
        const i = Number(last);
        if (Number.isInteger(i) && i >= 0 && i < parent.length) parent.splice(i, 1);
      } else if (Object.prototype.hasOwnProperty.call(parent, last)) {
        delete parent[last];
      }
      return JSON.stringify(r.value);
    }

    fillTemplate({ TEMPLATE, JSON: json }) {
      const r = parseJsonSafe(json);
      const data = r.ok ? r.value : {};
      return Cast.toString(TEMPLATE).replace(/\{\{?\s*([\w.[\]-]+)\s*\}?\}/g, (m, path) => {
        const v = jsonGet(data, parsePath(path));
        if (v === undefined) return m;
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
      });
    }

    similarity({ A, B: b }) {
      const x = Cast.toString(A).trim().toLowerCase().slice(0, 2000);
      const y = Cast.toString(b).trim().toLowerCase().slice(0, 2000);
      const max = Math.max(x.length, y.length);
      if (max === 0) return 100;
      return Math.round((1 - levenshtein(x, y) / max) * 1000) / 10;
    }
  }

  Scratch.extensions.register(new AppData());
})(Scratch);
