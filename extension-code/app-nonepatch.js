// Name: App 9-patch
// ID: appnonepatch
// Description: Nine-slice scaling for the selected costume with real-time resizing.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('9-Patch must run unsandboxed.');
  }

  const runtime = Scratch.vm.runtime;
  const Cast = Scratch.Cast;
  const BT = Scratch.BlockType;
  const AT = Scratch.ArgumentType;

  const EXT_ID = 'appnonepatch';
  const SHAPE_ID = `${EXT_ID}-frame`;
  const MAX_DIM = 8192;
  const MAX_PX = 4096;
  const MAX_TILES = 20000;

  if (Scratch.gui) {
    Scratch.gui.getBlockly().then((ScratchBlocks) => {
      try {
        const G = ScratchBlocks.BlockSvg.GRID_UNIT;
        ScratchBlocks.BlockSvg.registerCustomShape(SHAPE_ID, {
          emptyInputPath: 'm 16 0 h 16 h 12 l 8 8 l 0 16 l -8 8 h -12 h -16 h -8 l -8 -8 l 0 -16 l 8 -8 z',
          emptyInputWidth: 13 * G,
          leftPath: (block) => {
            const height = block.height;
            return [`h -8 l -8 -8 l 0 ${-(height - 16)} l 8 -8`];
          },
          rightPath: (block) => {
            const height = block.edgeShapeWidth_ * 2;
            return [`h 12 l 8 8 l 0 ${height - 16} l -8 8 h -12`];
          },
          blockPadding: {
            internal: {},
            external: {}
          },
          blockPaddingStart: (block, otherShape, firstInput) => {
            return Math.max((firstInput.renderHeight - ScratchBlocks.BlockSvg.MIN_BLOCK_Y_REPORTER) / 8, 0);
          },
          blockPaddingEnd: (block, otherShape, lastInput) => {
            return Math.max((lastInput.renderHeight - ScratchBlocks.BlockSvg.MIN_BLOCK_Y_REPORTER) / 2, 0);
          }
        });
      } catch (e) {
        console.warn('[9-Patch] could not register block shape:', e);
      }
    });
  }

  const num = (v, d) => {
    const n = Cast.toNumber(v);
    return Number.isFinite(n) ? n : d;
  };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const clampSize = (n) => clamp(Number.isFinite(n) ? n : 1, 1, MAX_DIM);
  const targetOf = (util) => (util && util.target) || null;

  const bounceOut = (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  };

  const EASE_BASE = {
    sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    quad: (t) => t * t,
    cubic: (t) => t * t * t,
    quart: (t) => t * t * t * t,
    quint: (t) => t * t * t * t * t,
    expo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    circ: (t) => 1 - Math.sqrt(1 - t * t),
    back: (t) => {
      const c1 = 1.70158;
      return (c1 + 1) * t * t * t - c1 * t * t;
    },
    elastic: (t) => {
      if (t === 0 || t === 1) return t;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
    },
    bounce: (t) => 1 - bounceOut(1 - t)
  };

  const EASINGS = { linear: (t) => t };
  const EASE_KEYS = { linear: 'linear', in: 'cubicIn', out: 'cubicOut', inout: 'cubicInOut' };
  const EASE_ITEMS = [{ text: 'linear', value: 'linear' }];

  for (const name of Object.keys(EASE_BASE)) {
    const f = EASE_BASE[name];
    const variants = [
      ['In', 'in', f],
      ['Out', 'out', (t) => 1 - f(1 - t)],
      ['InOut', 'in-out', (t) => (t < 0.5 ? f(2 * t) / 2 : 1 - f(2 - 2 * t) / 2)]
    ];
    for (const [suffix, label, fn] of variants) {
      const key = name + suffix;
      EASINGS[key] = fn;
      EASE_KEYS[key.toLowerCase()] = key;
      EASE_ITEMS.push({ text: `${name} ${label}`, value: key });
    }
  }

  const MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp'
  };

  const costumeKey = (c) => `${c.assetId || c.md5 || ''}|${c.bitmapResolution || 1}|${c.dataFormat || ''}`;

  const loadImage = (blob) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not decode the costume image.'));
      };
      img.src = url;
    });

  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  async function loadBitmap(data, mime, bitmapRes) {
    const img = await loadImage(new Blob([data], { type: mime }));
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error('Empty image.');
    const canvas = makeCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const res = bitmapRes > 0 ? bitmapRes : 1;
    return { canvas, origW: w / res, origH: h / res, resX: res, resY: res };
  }

  async function loadSvg(data) {
    const text = new TextDecoder('utf-8').decode(data);
    let out = text;
    let vw = 0;
    let vh = 0;
    let scale = 1;
    try {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg && svg.nodeName.toLowerCase() === 'svg' && !doc.querySelector('parsererror')) {
        const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
        if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
          vw = vb[2];
          vh = vb[3];
        } else {
          const w = parseFloat(svg.getAttribute('width'));
          const h = parseFloat(svg.getAttribute('height'));
          if (w > 0 && h > 0) {
            vw = w;
            vh = h;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          }
        }
        if (vw > 0 && vh > 0) {
          const big = Math.max(vw, vh);
          scale = Math.min(4, Math.max(1, 2048 / big), MAX_PX / big);
          svg.setAttribute('width', String(vw * scale));
          svg.setAttribute('height', String(vh * scale));
          out = new XMLSerializer().serializeToString(svg);
        }
      }
    } catch (e) {
      vw = 0;
      vh = 0;
      out = text;
    }
    const img = await loadImage(new Blob([out], { type: 'image/svg+xml' }));
    if (vw > 0 && vh > 0) {
      const canvas = makeCanvas(vw * scale, vh * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return { canvas, origW: vw, origH: vh, resX: canvas.width / vw, resY: canvas.height / vh };
    }
    const w = img.naturalWidth || 100;
    const h = img.naturalHeight || 100;
    const canvas = makeCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, origW: w, origH: h, resX: 1, resY: 1 };
  }

  async function loadCostumeImage(costume) {
    const asset = costume.asset;
    if (!asset || !asset.data) throw new Error('Costume has no image data.');
    const fmt = String(costume.dataFormat || asset.dataFormat || 'png').toLowerCase();
    if (fmt === 'svg') return loadSvg(asset.data);
    return loadBitmap(asset.data, MIME[fmt] || 'image/png', costume.bitmapResolution || 1);
  }

  function fitBorders(a, b, total) {
    a = clamp(Math.round(a), 0, total);
    b = clamp(Math.round(b), 0, total);
    if (total < 3) return [0, 0];
    const maxSum = total - 1;
    if (a + b > maxSum) {
      const k = maxSum / (a + b);
      a = Math.floor(a * k);
      b = Math.floor(b * k);
    }
    return [a, b];
  }

  function drawTiled(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, tileX, tileY, kx, ky) {
    const tw = tileX ? Math.max(1, sw * kx) : dw;
    const th = tileY ? Math.max(1, sh * ky) : dh;
    const nx = Math.ceil(dw / tw);
    const ny = Math.ceil(dh / th);
    if (nx * ny > MAX_TILES) {
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    for (let j = 0; j < ny; j++) {
      const y0 = Math.round(j * th);
      const y1 = Math.min(dh, Math.round((j + 1) * th));
      const h = y1 - y0;
      if (h <= 0) continue;
      const fy = Math.min(1, (y1 - j * th) / th);
      for (let i = 0; i < nx; i++) {
        const x0 = Math.round(i * tw);
        const x1 = Math.min(dw, Math.round((i + 1) * tw));
        const w = x1 - x0;
        if (w <= 0) continue;
        const fx = Math.min(1, (x1 - i * tw) / tw);
        ctx.drawImage(img, sx, sy, sw * fx, sh * fy, dx + x0, dy + y0, w, h);
      }
    }
  }

  class NinePatch {
    constructor() {
      this.states = new Map();

      this._onAfterExecute = this._onAfterExecute.bind(this);
      runtime.on('AFTER_EXECUTE', this._onAfterExecute);
      runtime.on('PROJECT_STOP_ALL', () => this._disposeAll());
      runtime.on('PROJECT_LOADED', () => this._disposeAll());
      runtime.on('targetWasRemoved', (t) => this._disposeTarget(t));
      runtime.on('targetWasCreated', (clone, original) => this._onTargetCreated(clone, original));
    }

    getInfo() {
      return {
        id: EXT_ID,
        name: 'App 9-patch',
        color1: '#8a5cf5',
        color2: '#7a4ce0',
        color3: '#6a3fc7',
        blocks: [
          {
            opcode: 'enable',
            blockType: BT.COMMAND,
            text: 'enable 9-patch'
          },
          {
            opcode: 'disable',
            blockType: BT.COMMAND,
            text: 'disable 9-patch'
          },
          {
            opcode: 'isEnabled',
            blockType: BT.BOOLEAN,
            text: '9-patch enabled?',
            disableMonitor: true
          },
          {
            opcode: 'selectCostume',
            blockType: BT.COMMAND,
            text: 'select costume [COSTUME] as 9-patch',
            arguments: {
              COSTUME: { type: AT.COSTUME }
            }
          },
          '---',
          {
            opcode: 'setSize',
            blockType: BT.COMMAND,
            text: 'set size width [W] height [H]',
            arguments: {
              W: { type: AT.NUMBER, defaultValue: 120 },
              H: { type: AT.NUMBER, defaultValue: 80 }
            }
          },
          {
            opcode: 'setWidth',
            blockType: BT.COMMAND,
            text: 'set width to [W]',
            arguments: {
              W: { type: AT.NUMBER, defaultValue: 120 }
            }
          },
          {
            opcode: 'setHeight',
            blockType: BT.COMMAND,
            text: 'set height to [H]',
            arguments: {
              H: { type: AT.NUMBER, defaultValue: 80 }
            }
          },
          {
            opcode: 'tweenSizeAndWait',
            blockType: BT.COMMAND,
            text: 'animate size to [W] x [H] in [T] secs [EASE] and wait',
            arguments: {
              W: { type: AT.NUMBER, defaultValue: 200 },
              H: { type: AT.NUMBER, defaultValue: 120 },
              T: { type: AT.NUMBER, defaultValue: 1 },
              EASE: { type: AT.STRING, menu: 'EASE', defaultValue: 'cubicInOut' }
            }
          },
          {
            opcode: 'tweenSize',
            blockType: BT.COMMAND,
            text: 'animate size to [W] x [H] in [T] secs [EASE]',
            arguments: {
              W: { type: AT.NUMBER, defaultValue: 200 },
              H: { type: AT.NUMBER, defaultValue: 120 },
              T: { type: AT.NUMBER, defaultValue: 1 },
              EASE: { type: AT.STRING, menu: 'EASE', defaultValue: 'cubicInOut' }
            }
          },
          '---',
          {
            opcode: 'setBorders',
            blockType: BT.COMMAND,
            text: 'set borders left [L] right [R] top [T] bottom [B]',
            arguments: {
              L: { type: AT.NUMBER, defaultValue: 16 },
              R: { type: AT.NUMBER, defaultValue: 16 },
              T: { type: AT.NUMBER, defaultValue: 16 },
              B: { type: AT.NUMBER, defaultValue: 16 }
            }
          },
          {
            opcode: 'setFill',
            blockType: BT.COMMAND,
            text: 'fill [PART] with [MODE]',
            arguments: {
              PART: { type: AT.STRING, menu: 'PART', defaultValue: 'all' },
              MODE: { type: AT.STRING, menu: 'FILL', defaultValue: 'stretch' }
            }
          },
          {
            opcode: 'setInterfaceSize',
            blockType: BT.COMMAND,
            text: 'set interface size to [N] %',
            arguments: {
              N: { type: AT.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'changeInterfaceSize',
            blockType: BT.COMMAND,
            text: 'change interface size by [N] %',
            arguments: {
              N: { type: AT.NUMBER, defaultValue: 10 }
            }
          },
          '---',
          {
            opcode: 'getInterfaceSize',
            blockType: BT.REPORTER,
            text: '9-patch interface size',
            blockShape: SHAPE_ID,
            disableMonitor: true
          },
          {
            opcode: 'getWidth',
            blockType: BT.REPORTER,
            text: '9-patch width',
            blockShape: SHAPE_ID,
            disableMonitor: true
          },
          {
            opcode: 'getHeight',
            blockType: BT.REPORTER,
            text: '9-patch height',
            blockShape: SHAPE_ID,
            disableMonitor: true
          },
          {
            opcode: 'whenResized',
            blockType: BT.EVENT,
            text: 'when 9-patch is resized',
            isEdgeActivated: false,
            shouldRestartExistingThreads: false
          }
        ],
        menus: {
          PART: {
            acceptReporters: true,
            items: [
              { text: 'everything', value: 'all' },
              { text: 'edges', value: 'edges' },
              { text: 'center', value: 'center' }
            ]
          },
          FILL: {
            acceptReporters: true,
            items: [
              { text: 'stretch', value: 'stretch' },
              { text: 'tile', value: 'tile' }
            ]
          },
          EASE: {
            acceptReporters: true,
            items: EASE_ITEMS
          }
        }
      };
    }

    _state(target) {
      let st = this.states.get(target.id);
      if (!st) {
        st = {
          active: false,
          dead: false,
          width: null,
          height: null,
          borders: null,
          edgeMode: 'stretch',
          centerMode: 'stretch',
          uiScale: 1,
          override: null,
          source: null,
          loadingKey: null,
          loadPromise: null,
          failedKey: null,
          canvas: null,
          skinId: null,
          sig: '',
          lastW: null,
          lastH: null,
          tween: null
        };
        this.states.set(target.id, st);
      }
      return st;
    }

    _stateFor(target) {
      if (!target || target.isStage) return null;
      return this._state(target);
    }

    _pickCostume(target, st) {
      const list = target.sprite && target.sprite.costumes;
      if (!list || !list.length) return null;
      if (st && st.override != null) {
        let idx = -1;
        if (typeof target.getCostumeIndexByName === 'function') {
          idx = target.getCostumeIndexByName(String(st.override));
        }
        if (idx < 0) {
          const n = Number(st.override);
          if (Number.isFinite(n) && String(st.override).trim() !== '') {
            idx = (((Math.round(n) - 1) % list.length) + list.length) % list.length;
          }
        }
        if (idx >= 0 && list[idx]) return list[idx];
      }
      return list[target.currentCostume] || list[0];
    }

    _costumeSize(target) {
      const st = this.states.get(target.id);
      if (st && st.source) return [st.source.origW, st.source.origH];
      const c = this._pickCostume(target, st);
      if (c) {
        const r = runtime.renderer;
        const skin = r && r._allSkins && r._allSkins[c.skinId];
        if (skin && skin.size) return [skin.size[0], skin.size[1]];
      }
      return [100, 100];
    }

    _curW(target, st) {
      return st.width != null ? st.width : this._costumeSize(target)[0];
    }

    _curH(target, st) {
      return st.height != null ? st.height : this._costumeSize(target)[1];
    }

    _ensureBorders(target, st) {
      if (!st.borders) {
        const [w, h] = this._costumeSize(target);
        const bx = Math.round(w / 4);
        const by = Math.round(h / 4);
        st.borders = { l: bx, r: bx, t: by, b: by };
      }
      return st.borders;
    }

    _ensureSource(target, st) {
      const costume = this._pickCostume(target, st);
      if (!costume) return Promise.resolve(false);
      const key = costumeKey(costume);
      if (st.source && st.source.key === key) return Promise.resolve(true);
      if (st.loadingKey === key && st.loadPromise) return st.loadPromise;

      st.loadingKey = key;
      st.failedKey = null;
      const p = loadCostumeImage(costume)
        .then((src) => {
          if (st.dead || !st.active) return false;
          if (st.loadingKey !== key) return this._ensureSource(target, st);
          src.key = key;
          st.source = src;
          st.loadingKey = null;
          st.loadPromise = null;
          if (!st.borders) {
            const bx = Math.round(src.origW / 4);
            const by = Math.round(src.origH / 4);
            st.borders = { l: bx, r: bx, t: by, b: by };
          }
          if (st.width == null) st.width = src.origW;
          if (st.height == null) st.height = src.origH;
          this._commit(target, st);
          return true;
        })
        .catch((err) => {
          console.warn('[9-Patch]', err);
          if (st.loadingKey === key) {
            st.loadingKey = null;
            st.loadPromise = null;
            st.failedKey = key;
          }
          return false;
        });
      st.loadPromise = p;
      return p;
    }

    _geometry(st) {
      const src = st.source;
      const W = clampSize(st.width == null ? src.origW : st.width);
      const H = clampSize(st.height == null ? src.origH : st.height);
      let res = Math.min(src.resX, MAX_PX / W, MAX_PX / H);
      if (!(res > 0)) res = 1;
      const cw = Math.max(1, Math.round(W * res));
      const ch = Math.max(1, Math.round(H * res));

      const b = st.borders;
      const sw = src.canvas.width;
      const sh = src.canvas.height;
      const [sl, sr] = fitBorders(Math.max(0, b.l) * src.resX, Math.max(0, b.r) * src.resX, sw);
      const [stp, sbt] = fitBorders(Math.max(0, b.t) * src.resY, Math.max(0, b.b) * src.resY, sh);

      const kx = (res / src.resX) * st.uiScale;
      const ky = (res / src.resY) * st.uiScale;
      let dl = sl * kx;
      let dr = sr * kx;
      let dt = stp * ky;
      let db = sbt * ky;
      if (dl + dr > cw) {
        const k = cw / (dl + dr);
        dl *= k;
        dr *= k;
      }
      if (dt + db > ch) {
        const k = ch / (dt + db);
        dt *= k;
        db *= k;
      }
      dl = Math.round(dl);
      dr = Math.min(Math.round(dr), cw - dl);
      dt = Math.round(dt);
      db = Math.min(Math.round(db), ch - dt);
      if (!sl) dl = 0;
      if (!sr) dr = 0;
      if (!stp) dt = 0;
      if (!sbt) db = 0;

      const g = {
        W,
        H,
        res,
        cw,
        ch,
        kx,
        ky,
        sx: [0, sl, sw - sr, sw],
        sy: [0, stp, sh - sbt, sh],
        dx: [0, dl, cw - dr, cw],
        dy: [0, dt, ch - db, ch]
      };
      g.sig = [
        src.key,
        W,
        H,
        cw,
        ch,
        g.sx.join(','),
        g.sy.join(','),
        g.dx.join(','),
        g.dy.join(','),
        st.edgeMode,
        st.centerMode,
        st.uiScale.toFixed(4)
      ].join('|');
      return g;
    }

    _paint(st, g) {
      const src = st.source;
      if (!st.canvas) st.canvas = document.createElement('canvas');
      const cv = st.canvas;
      if (cv.width !== g.cw || cv.height !== g.ch) {
        cv.width = g.cw;
        cv.height = g.ch;
      }
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const sx = g.sx[i];
          const sy = g.sy[j];
          const sw = g.sx[i + 1] - sx;
          const sh = g.sy[j + 1] - sy;
          const dx = g.dx[i];
          const dy = g.dy[j];
          const dw = g.dx[i + 1] - dx;
          const dh = g.dy[j + 1] - dy;
          if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;

          let tileX = false;
          let tileY = false;
          if (i === 1 && j === 1) {
            if (st.centerMode === 'tile') tileX = tileY = true;
          } else if (j === 1) {
            if (st.edgeMode === 'tile') tileY = true;
          } else if (i === 1) {
            if (st.edgeMode === 'tile') tileX = true;
          }

          if (tileX || tileY) {
            drawTiled(ctx, src.canvas, sx, sy, sw, sh, dx, dy, dw, dh, tileX, tileY, g.kx, g.ky);
          } else {
            ctx.drawImage(src.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
          }
        }
      }
    }

    _commit(target, st) {
      if (!st.active || !st.source || st.dead || target.isStage) return;
      const r = runtime.renderer;
      if (!r || target.drawableID == null) return;
      try {
        const g = this._geometry(st);
        if (g.sig !== st.sig || st.skinId == null) {
          this._paint(st, g);
          const cx = g.cw / g.res / 2;
          const cy = g.ch / g.res / 2;
          if (st.skinId == null) {
            st.skinId = r.createBitmapSkin(st.canvas, g.res, [cx, cy]);
          } else {
            r.updateBitmapSkin(st.skinId, st.canvas, g.res, [cx, cy]);
          }
          st.sig = g.sig;
          runtime.requestRedraw();
        }
        r.updateDrawableSkinId(target.drawableID, st.skinId);

        if (st.lastW !== g.W || st.lastH !== g.H) {
          const first = st.lastW === null;
          st.lastW = g.W;
          st.lastH = g.H;
          if (!first) this._fireResized(target);
        }
      } catch (e) {
        console.warn('[9-Patch] draw error:', e);
      }
    }

    _fireResized(target) {
      try {
        runtime.startHats(`${EXT_ID}_whenResized`, null, target);
      } catch (e) {
        console.warn('[9-Patch]', e);
      }
    }

    async _setActive(target, on) {
      const st = this._stateFor(target);
      if (!st) return;
      if (on) {
        st.active = true;
        const ok = await this._ensureSource(target, st);
        if (st.dead) return;
        if (!ok && st.active && !st.source) {
          st.active = false;
          this._releaseSkin(target, st);
        }
      } else if (st.active) {
        this._deactivate(target, st);
      }
    }

    _releaseSkin(target, st) {
      if (st.skinId == null) return;
      if (target && target.drawableID != null) {
        try {
          target.setCostume(target.currentCostume);
        } catch (e) {
          console.warn('[9-Patch]', e);
        }
      }
      try {
        if (runtime.renderer) runtime.renderer.destroySkin(st.skinId);
      } catch (e) {
        console.warn('[9-Patch]', e);
      }
      st.skinId = null;
      try {
        runtime.requestRedraw();
      } catch (e) {
        console.warn('[9-Patch]', e);
      }
    }

    _resolveTween(st) {
      if (st.tween) {
        const done = st.tween.resolve;
        st.tween = null;
        done();
      }
    }

    _deactivate(target, st) {
      st.active = false;
      this._resolveTween(st);
      this._releaseSkin(target, st);
      st.source = null;
      st.override = null;
      st.loadingKey = null;
      st.loadPromise = null;
      st.failedKey = null;
      st.canvas = null;
      st.sig = '';
      st.lastW = null;
      st.lastH = null;
    }

    _disposeState(id, st, target) {
      st.dead = true;
      st.active = false;
      this._resolveTween(st);
      this._releaseSkin(target, st);
      st.source = null;
      st.canvas = null;
      this.states.delete(id);
    }

    _disposeTarget(target) {
      if (!target) return;
      const st = this.states.get(target.id);
      if (st) this._disposeState(target.id, st, null);
    }

    _disposeAll() {
      for (const [id, st] of Array.from(this.states)) {
        this._disposeState(id, st, runtime.getTargetById(id));
      }
    }

    _onTargetCreated(clone, original) {
      try {
        if (!clone || !original || clone.isStage) return;
        const o = this.states.get(original.id);
        if (!o || !o.active) return;
        const st = this._state(clone);
        st.width = o.width;
        st.height = o.height;
        st.borders = o.borders ? { ...o.borders } : null;
        st.edgeMode = o.edgeMode;
        st.centerMode = o.centerMode;
        st.uiScale = o.uiScale;
        st.override = o.override;
        st.active = true;
        this._ensureSource(clone, st);
      } catch (e) {
        console.warn('[9-Patch]', e);
      }
    }

    _onAfterExecute() {
      if (this.states.size === 0) return;
      const now = performance.now();
      for (const [id, st] of Array.from(this.states)) {
        const target = runtime.getTargetById(id);
        if (!target) {
          this._disposeState(id, st, null);
          continue;
        }
        if (!st.active) continue;
        try {
          this._tickTween(target, st, now);

          const costume = this._pickCostume(target, st);
          if (costume) {
            const key = costumeKey(costume);
            if ((!st.source || st.source.key !== key) && st.loadingKey !== key && st.failedKey !== key) {
              this._ensureSource(target, st);
            }
          }

          if (st.skinId != null && runtime.renderer && target.drawableID != null) {
            runtime.renderer.updateDrawableSkinId(target.drawableID, st.skinId);
          }
        } catch (e) {
          console.warn('[9-Patch]', e);
        }
      }
    }

    _tickTween(target, st, now) {
      const tw = st.tween;
      if (!tw) return;
      let t = tw.dur <= 0 ? 1 : (now - tw.start) / tw.dur;
      t = clamp(t, 0, 1);
      const k = (EASINGS[tw.ease] || EASINGS.linear)(t);
      st.width = clampSize(tw.fromW + (tw.toW - tw.fromW) * k);
      st.height = clampSize(tw.fromH + (tw.toH - tw.fromH) * k);
      if (t >= 1) {
        st.width = tw.toW;
        st.height = tw.toH;
      }
      this._commit(target, st);
      if (t >= 1) this._resolveTween(st);
    }

    enable(args, util) {
      return this._setActive(targetOf(util), true);
    }

    disable(args, util) {
      return this._setActive(targetOf(util), false);
    }

    isEnabled(args, util) {
      const t = targetOf(util);
      const st = t ? this.states.get(t.id) : null;
      return !!(st && st.active);
    }

    async selectCostume(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.override = Cast.toString(args.COSTUME);
      if (st.active) {
        await this._ensureSource(t, st);
      } else {
        await this._setActive(t, true);
      }
    }

    setSize(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.width = clampSize(num(args.W, this._curW(t, st)));
      st.height = clampSize(num(args.H, this._curH(t, st)));
      this._commit(t, st);
    }

    setWidth(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.width = clampSize(num(args.W, this._curW(t, st)));
      this._commit(t, st);
    }

    setHeight(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.height = clampSize(num(args.H, this._curH(t, st)));
      this._commit(t, st);
    }

    _startTween(t, st, args) {
      const fromW = this._curW(t, st);
      const fromH = this._curH(t, st);
      const toW = clampSize(num(args.W, fromW));
      const toH = clampSize(num(args.H, fromH));
      const dur = Math.max(0, num(args.T, 0)) * 1000;
      this._resolveTween(st);
      if (!st.active || dur <= 0) {
        st.width = toW;
        st.height = toH;
        this._commit(t, st);
        return null;
      }
      const ease = EASE_KEYS[String(args.EASE).trim().toLowerCase().replace(/[\s_-]/g, '')] || 'cubicInOut';
      return new Promise((resolve) => {
        st.tween = {
          fromW,
          fromH,
          toW,
          toH,
          dur,
          ease,
          start: performance.now(),
          resolve
        };
      });
    }

    async tweenSizeAndWait(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      await this._startTween(t, st, args);
    }

    tweenSize(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      this._startTween(t, st, args);
    }

    setBorders(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      const b = this._ensureBorders(t, st);
      b.l = clamp(num(args.L, b.l), 0, 100000);
      b.r = clamp(num(args.R, b.r), 0, 100000);
      b.t = clamp(num(args.T, b.t), 0, 100000);
      b.b = clamp(num(args.B, b.b), 0, 100000);
      this._commit(t, st);
    }

    setFill(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      const part = String(args.PART).trim().toLowerCase();
      const mode = String(args.MODE).trim().toLowerCase() === 'tile' ? 'tile' : 'stretch';
      if (part === 'edges' || part === 'all') st.edgeMode = mode;
      if (part === 'center' || part === 'all') st.centerMode = mode;
      this._commit(t, st);
    }

    setInterfaceSize(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.uiScale = clamp(num(args.N, 100), 1, 2000) / 100;
      this._commit(t, st);
    }

    changeInterfaceSize(args, util) {
      const t = targetOf(util);
      const st = this._stateFor(t);
      if (!st) return;
      st.uiScale = clamp(st.uiScale * 100 + num(args.N, 0), 1, 2000) / 100;
      this._commit(t, st);
    }

    getInterfaceSize(args, util) {
      const t = targetOf(util);
      const st = t ? this.states.get(t.id) : null;
      return Math.round((st ? st.uiScale : 1) * 10000) / 100;
    }

    getWidth(args, util) {
      const t = targetOf(util);
      if (!t) return 0;
      const st = this.states.get(t.id);
      return Math.round((st && st.width != null ? st.width : this._costumeSize(t)[0]) * 100) / 100;
    }

    getHeight(args, util) {
      const t = targetOf(util);
      if (!t) return 0;
      const st = this.states.get(t.id);
      return Math.round((st && st.height != null ? st.height : this._costumeSize(t)[1]) * 100) / 100;
    }
  }

  Scratch.extensions.register(new NinePatch());
})(Scratch);
