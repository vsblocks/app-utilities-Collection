// Name: App Events
// ID: appevents
// Description: Online, visibility, resize, theme, hash, shortcut, idle and swipe events.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Events must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const EXT_ID = 'appevents';

  const state = {
    lastShortcut: '',
    lastActivity: Date.now()
  };

  const blockedShortcuts = new Set();

  const evt = { swipe: '', swipeDistance: 0 };

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  let swipeStart = null;

  const MOD_ORDER = ['ctrl', 'alt', 'shift'];

  const KEY_ALIASES = {
    esc: 'escape',
    del: 'delete',
    return: 'enter',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
    spacebar: 'space',
    ' ': 'space'
  };

  const normalizeCombo = (str) => {
    const parts = Cast.toString(str)
      .toLowerCase()
      .split('+')
      .map((s) => s.trim());
    const mods = new Set();
    let key = '';
    parts.forEach((p) => {
      if (['ctrl', 'control', 'cmd', 'command', 'meta'].includes(p)) mods.add('ctrl');
      else if (p === 'alt' || p === 'option') mods.add('alt');
      else if (p === 'shift') mods.add('shift');
      else if (p) key = KEY_ALIASES[p] || p;
    });
    return [...MOD_ORDER.filter((m) => mods.has(m)), key].filter(Boolean).join('+');
  };

  const comboFromEvent = (e) => {
    let key = (e.key || '').toLowerCase();
    key = KEY_ALIASES[key] || key;
    if (['control', 'alt', 'shift', 'meta', ''].includes(key)) return '';
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.shiftKey) mods.push('shift');
    return [...mods, key].join('+');
  };

  const COLORS = {
    events: ['#f43f5e', '#e11d48', '#be123c']
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

  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((type) =>
    window.addEventListener(
      type,
      () => {
        state.lastActivity = Date.now();
      },
      { passive: true, capture: true }
    )
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    true
  );

  window.addEventListener('pointercancel', () => {
    swipeStart = null;
  });

  window.addEventListener(
    'pointerup',
    (e) => {
      if (!swipeStart) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      const dt = Date.now() - swipeStart.t;
      swipeStart = null;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < 40 || dt > 900) return;
      evt.swipe = ax > ay ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      evt.swipeDistance = Math.round(Math.max(ax, ay));
      fire('whenSwipe');
    },
    true
  );

  window.addEventListener('online', () => fire('whenOnline'));

  window.addEventListener('offline', () => fire('whenOffline'));

  window.addEventListener('resize', () => fire('whenResized'));

  document.addEventListener('visibilitychange', () => {
    fire(document.hidden ? 'whenHidden' : 'whenVisible');
  });

  window.addEventListener('hashchange', () => fire('whenHashChanged'));

  window.addEventListener(
    'keydown',
    (e) => {
      const t = e.target;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      if (blockedShortcuts.has(combo)) e.preventDefault();
      state.lastShortcut = combo;
      fire('whenShortcut');
    },
    true
  );

  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', () => fire('whenThemeChanged'));
    }
  } catch (e) {}

  class AppEvents {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Events',
        color1: '#f43f5e',
        color2: '#e11d48',
        color3: '#be123c',
        blocks: [
          label('Events'),
          B('events', {
            opcode: 'whenOnline',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when device goes online'
          }),
          B('events', {
            opcode: 'whenOffline',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when device goes offline'
          }),
          B('events', {
            opcode: 'whenHidden',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when app goes to background'
          }),
          B('events', {
            opcode: 'whenVisible',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when app comes to foreground'
          }),
          B('events', {
            opcode: 'whenResized',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when window is resized'
          }),
          B('events', {
            opcode: 'whenThemeChanged',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when system theme changes'
          }),
          B('events', {
            opcode: 'whenHashChanged',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when URL hash changes'
          }),
          B('events', {
            opcode: 'whenShortcut',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when shortcut [COMBO] is pressed',
            arguments: { COMBO: str('ctrl+k') }
          }),
          B('events', {
            opcode: 'blockShortcut',
            blockType: BT.COMMAND,
            text: '[STATE] browser default for shortcut [COMBO]',
            arguments: { STATE: str('block', 'blockStates'), COMBO: str('ctrl+s') }
          }),
          B('events', {
            opcode: 'whenNotificationClicked',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when a notification is clicked'
          }),
          '---',
          B('events', {
            opcode: 'whenIdle',
            blockType: BT.HAT,
            isEdgeActivated: true,
            text: 'when user is idle for [SECS] seconds',
            arguments: { SECS: num(30) }
          }),
          B('events', {
            opcode: 'userIdle',
            blockType: BT.BOOLEAN,
            text: 'user idle for [SECS] seconds?',
            arguments: { SECS: num(30) }
          }),
          B('events', { opcode: 'secondsIdle', blockType: BT.REPORTER, text: 'seconds since last activity' }),
          B('events', {
            opcode: 'whenSwipe',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when swiped [DIR]',
            arguments: { DIR: str('any', 'swipeDirs') }
          }),
          B('events', { opcode: 'lastSwipeDirection', blockType: BT.REPORTER, text: 'last swipe direction' }),
          B('events', {
            opcode: 'lastSwipeDistance',
            blockType: BT.REPORTER,
            text: 'last swipe distance (px)'
          })
        ],
        menus: {
          swipeDirs: items(
            pairs([
              ['any direction', 'any'],
              ['left', 'left'],
              ['right', 'right'],
              ['up', 'up'],
              ['down', 'down']
            ])
          ),
          blockStates: items(
            pairs([
              ['block', 'block'],
              ['allow', 'allow']
            ])
          )
        }
      };
    }

    whenOnline() {
      return true;
    }

    whenOffline() {
      return true;
    }

    whenHidden() {
      return true;
    }

    whenVisible() {
      return true;
    }

    whenResized() {
      return true;
    }

    whenThemeChanged() {
      return true;
    }

    whenHashChanged() {
      return true;
    }

    whenShortcut({ COMBO }) {
      return normalizeCombo(COMBO) === state.lastShortcut;
    }

    blockShortcut({ STATE, COMBO }) {
      const combo = normalizeCombo(COMBO);
      if (!combo) return;
      if (Cast.toString(STATE) === 'allow') blockedShortcuts.delete(combo);
      else blockedShortcuts.add(combo);
    }

    whenNotificationClicked() {
      return true;
    }

    whenIdle({ SECS }) {
      return (Date.now() - state.lastActivity) / 1000 >= Math.max(0.1, Cast.toNumber(SECS));
    }

    userIdle({ SECS }) {
      return (Date.now() - state.lastActivity) / 1000 >= Math.max(0, Cast.toNumber(SECS));
    }

    secondsIdle() {
      return Math.round((Date.now() - state.lastActivity) / 100) / 10;
    }

    whenSwipe({ DIR }) {
      const d = Cast.toString(DIR);
      return evt.swipe !== '' && (d === 'any' || d === evt.swipe);
    }

    lastSwipeDirection() {
      return evt.swipe;
    }

    lastSwipeDistance() {
      return evt.swipeDistance;
    }
  }

  Scratch.extensions.register(new AppEvents());
})(Scratch);
