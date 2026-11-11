// Name: App Timers
// ID: apptimers
// Description: Named timers, repeating timers, alarms, cooldowns and run-once flags.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Timers must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'apptimers';

  const timers = new Map();

  const cooldowns = new Map();

  const onceKeys = new Set();

  const timerEvents = new Map();

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const toDate = (v) => {
    const s = Cast.toString(v).trim();
    if (s === '') return new Date();
    return /^-?\d+(\.\d+)?$/.test(s) ? new Date(Number(s)) : new Date(s);
  };

  const markTimerEvent = (name) => timerEvents.set(name, Date.now() + 250);

  const timerEventActive = (name) => (timerEvents.get(name) || 0) > Date.now();

  const armTimer = (t, delay) => {
    clearTimeout(t.handle);
    t.cycleEnd = Date.now() + delay;
    t.handle = setTimeout(() => onTimer(t), Math.min(delay, 2147483647));
  };

  function onTimer(t) {
    if (timers.get(t.name) !== t) return;
    const left = t.cycleEnd - Date.now();
    if (left > 50) {
      t.handle = setTimeout(() => onTimer(t), Math.min(left, 2147483647));
      return;
    }
    t.fires++;
    markTimerEvent(t.name);
    if (t.repeat) armTimer(t, t.ms);
    else t.finished = true;
    fire('whenTimerFires');
  }

  const startTimer = (name, ms, repeat) => {
    const old = timers.get(name);
    if (old) clearTimeout(old.handle);
    const t = {
      name,
      ms: repeat ? Math.max(20, ms) : Math.max(0, ms),
      repeat,
      paused: false,
      finished: false,
      fires: 0,
      remaining: 0,
      cycleEnd: 0,
      handle: null
    };
    timers.set(name, t);
    armTimer(t, t.ms);
  };

  const timerLeftMs = (t) => {
    if (!t || t.finished) return 0;
    return t.paused ? t.remaining : Math.max(0, t.cycleEnd - Date.now());
  };

  const stopTimer = (name) => {
    const t = timers.get(name);
    if (t) clearTimeout(t.handle);
    timers.delete(name);
  };

  const stopAllTimers = () => {
    timers.forEach((t) => clearTimeout(t.handle));
    timers.clear();
  };

  const controlTimer = (name, action) => {
    const t = timers.get(name);
    if (!t) return;
    if (action === 'pause') {
      if (t.paused || t.finished) return;
      t.remaining = timerLeftMs(t);
      clearTimeout(t.handle);
      t.paused = true;
    } else if (action === 'resume') {
      if (!t.paused) return;
      t.paused = false;
      armTimer(t, t.remaining);
    } else if (action === 'restart') {
      t.paused = false;
      t.finished = false;
      armTimer(t, t.ms);
    }
  };

  const COLORS = {
    timers: ['#ec4899', '#db2777', '#be185d']
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

  const addLog = (text, level) => {
    const fn = console[level] || console.log;
    fn.call(console, `[App Timers] ${text}`);
  };

  runtime.on('PROJECT_STOP_ALL', () => {
    stopAllTimers();
  });

  class AppTimers {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Timers',
        color1: '#ec4899',
        color2: '#db2777',
        color3: '#be185d',
        blocks: [
          label('Timers & Tasks'),
          B('timers', {
            opcode: 'startTimer',
            blockType: BT.COMMAND,
            text: 'start timer [NAME] for [SECS] seconds',
            arguments: { NAME: str('countdown'), SECS: num(10) }
          }),
          B('timers', {
            opcode: 'startRepeating',
            blockType: BT.COMMAND,
            text: 'repeat timer [NAME] every [SECS] seconds',
            arguments: { NAME: str('autosave'), SECS: num(30) }
          }),
          B('timers', {
            opcode: 'startAlarm',
            blockType: BT.COMMAND,
            text: 'set alarm [NAME] for date [TIME]',
            arguments: { NAME: str('reminder'), TIME: str('2026-12-25 08:00') }
          }),
          B('timers', {
            opcode: 'controlTimer',
            blockType: BT.COMMAND,
            text: '[ACTION] timer [NAME]',
            arguments: { ACTION: str('pause', 'timerActions'), NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'stopTimer',
            blockType: BT.COMMAND,
            text: 'stop timer [NAME]',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', { opcode: 'stopAllTimers', blockType: BT.COMMAND, text: 'stop all timers' }),
          B('timers', {
            opcode: 'whenTimerFires',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when timer [NAME] fires',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'timerLeft',
            blockType: BT.REPORTER,
            text: 'time left on timer [NAME] (s)',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'timerProgress',
            blockType: BT.REPORTER,
            text: 'progress of timer [NAME] (%)',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'timerRunning',
            blockType: BT.BOOLEAN,
            text: 'timer [NAME] is running?',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'timerFinished',
            blockType: BT.BOOLEAN,
            text: 'timer [NAME] has finished?',
            arguments: { NAME: str('countdown') }
          }),
          B('timers', {
            opcode: 'timerFireCount',
            blockType: BT.REPORTER,
            text: 'times timer [NAME] fired',
            arguments: { NAME: str('autosave') }
          }),
          B('timers', {
            opcode: 'timerList',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'active timers as JSON list'
          }),
          '---',
          B('timers', {
            opcode: 'tryCooldown',
            blockType: BT.BOOLEAN,
            text: 'try action [NAME] with cooldown [SECS] seconds',
            arguments: { NAME: str('attack'), SECS: num(1.5) }
          }),
          B('timers', {
            opcode: 'cooldownLeft',
            blockType: BT.REPORTER,
            text: 'cooldown left of [NAME] (s)',
            arguments: { NAME: str('attack') }
          }),
          B('timers', {
            opcode: 'resetCooldown',
            blockType: BT.COMMAND,
            text: 'reset cooldown [NAME]',
            arguments: { NAME: str('attack') }
          }),
          B('timers', {
            opcode: 'runOnce',
            blockType: BT.BOOLEAN,
            text: 'first time for [KEY]? (marks it as done)',
            arguments: { KEY: str('tutorial') }
          }),
          B('timers', {
            opcode: 'forgetOnce',
            blockType: BT.COMMAND,
            text: 'forget run-once [KEY]',
            arguments: { KEY: str('tutorial') }
          })
        ],
        menus: {
          timerActions: items(
            pairs([
              ['pause', 'pause'],
              ['resume', 'resume'],
              ['restart', 'restart']
            ])
          )
        }
      };
    }

    startTimer({ NAME, SECS }) {
      startTimer(Cast.toString(NAME), Math.max(0, Cast.toNumber(SECS)) * 1000, false);
    }

    startRepeating({ NAME, SECS }) {
      startTimer(Cast.toString(NAME), Math.max(0.02, Cast.toNumber(SECS)) * 1000, true);
    }

    startAlarm({ NAME, TIME }) {
      const d = toDate(TIME);
      if (isNaN(d.getTime())) {
        addLog('set alarm: invalid date', 'warn', 'timers');
        return;
      }
      startTimer(Cast.toString(NAME), Math.max(0, d.getTime() - Date.now()), false);
    }

    controlTimer({ ACTION, NAME }) {
      controlTimer(Cast.toString(NAME), Cast.toString(ACTION));
    }

    stopTimer({ NAME }) {
      stopTimer(Cast.toString(NAME));
    }

    stopAllTimers() {
      stopAllTimers();
    }

    whenTimerFires({ NAME }) {
      return timerEventActive(Cast.toString(NAME));
    }

    timerLeft({ NAME }) {
      return Math.round(timerLeftMs(timers.get(Cast.toString(NAME))) / 10) / 100;
    }

    timerProgress({ NAME }) {
      const t = timers.get(Cast.toString(NAME));
      if (!t) return 0;
      if (t.finished) return 100;
      if (t.ms <= 0) return 100;
      return Math.round(clamp(100 - (timerLeftMs(t) / t.ms) * 100, 0, 100) * 10) / 10;
    }

    timerRunning({ NAME }) {
      const t = timers.get(Cast.toString(NAME));
      return !!t && !t.paused && !t.finished;
    }

    timerFinished({ NAME }) {
      const t = timers.get(Cast.toString(NAME));
      return !!t && t.finished;
    }

    timerFireCount({ NAME }) {
      const t = timers.get(Cast.toString(NAME));
      return t ? t.fires : 0;
    }

    timerList() {
      return JSON.stringify(
        Array.from(timers.values())
          .filter((t) => !t.finished)
          .map((t) => t.name)
      );
    }

    tryCooldown({ NAME, SECS }) {
      const name = Cast.toString(NAME);
      const now = Date.now();
      if (now < (cooldowns.get(name) || 0)) return false;
      cooldowns.set(name, now + Math.max(0, Cast.toNumber(SECS)) * 1000);
      return true;
    }

    cooldownLeft({ NAME }) {
      const left = (cooldowns.get(Cast.toString(NAME)) || 0) - Date.now();
      return left > 0 ? Math.round(left / 10) / 100 : 0;
    }

    resetCooldown({ NAME }) {
      cooldowns.delete(Cast.toString(NAME));
    }

    runOnce({ KEY }) {
      const k = Cast.toString(KEY);
      if (onceKeys.has(k)) return false;
      onceKeys.add(k);
      return true;
    }

    forgetOnce({ KEY }) {
      onceKeys.delete(Cast.toString(KEY));
    }
  }

  Scratch.extensions.register(new AppTimers());
})(Scratch);
