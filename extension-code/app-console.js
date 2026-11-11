// Name: App Console
// ID: appconsole
// Description: Console, logging, stopwatches, counters and an on-screen debug panel.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Console must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appconsole';

  const state = {
    catchErrors: false,
    lastError: '',
    lastLog: null,
    debugVisible: false
  };

  const MAX_LOG = 500;

  const logs = [];

  const groups = [];

  const stopwatches = new Map();

  const counters = new Map();

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const downloadBlob = (content, name, type) => {
    const fileName = Cast.toString(name).replace(/[\\/:*?"<>|]/g, '_') || 'file.txt';
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const getContainer = () => {
    const canvas = runtime.renderer && runtime.renderer.canvas;
    const el = canvas && canvas.parentElement;
    if (!el) return document.body;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return el;
  };

  const positionMode = (container) => (container === document.body ? 'fixed' : 'absolute');

  const LEVELS = ['log', 'info', 'success', 'warn', 'error', 'debug'];

  const LEVEL_COLORS = {
    log: '#e2e8f0',
    info: '#7dd3fc',
    success: '#86efac',
    warn: '#fde047',
    error: '#fca5a5',
    debug: '#a5b4fc'
  };

  const formatEntry = (e) =>
    `[${new Date(e.time).toTimeString().slice(0, 8)}] ${e.level.toUpperCase()}` +
    `${e.tag ? ` [${e.tag}]` : ''} ${e.group ? `${e.group}: ` : ''}${e.text}`;

  let debugEl = null;

  const hideDebug = () => {
    if (debugEl) debugEl.remove();
    debugEl = null;
  };

  const renderDebug = () => {
    if (!state.debugVisible) return;
    const container = getContainer();
    if (!debugEl || debugEl.parentElement !== container) {
      hideDebug();
      debugEl = document.createElement('div');
      debugEl.style.cssText =
        `position:${positionMode(container)};left:0;right:0;bottom:0;max-height:40%;overflow:hidden;` +
        'display:flex;flex-direction:column;justify-content:flex-end;padding:6px 8px;' +
        'background:rgba(15,23,42,.85);font:11px/1.45 ui-monospace,Consolas,monospace;' +
        'pointer-events:none;z-index:99998;box-sizing:border-box;';
      container.appendChild(debugEl);
    }
    debugEl.textContent = '';
    logs.slice(-40).forEach((e) => {
      const line = document.createElement('div');
      line.style.cssText = `color:${LEVEL_COLORS[e.level]};white-space:pre-wrap;word-break:break-word;`;
      line.textContent = formatEntry(e);
      debugEl.appendChild(line);
    });
  };

  const entriesOf = (level) => (level === 'any' ? logs : logs.filter((e) => e.level === level));

  const recordPageError = (message) => {
    if (!state.catchErrors) return;
    state.lastError = String(message);
    addLog(message, 'error', 'page');
    fire('whenErrorCaught');
  };

  const parseJsonSafe = (text) => {
    try {
      return { ok: true, value: JSON.parse(Cast.toString(text)) };
    } catch (e) {
      return { ok: false, value: undefined };
    }
  };

  const COLORS = {
    console: ['#64748b', '#475569', '#334155']
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

  const bool = () => ({ type: AT.BOOLEAN });

  const items = (list) => ({ acceptReporters: true, items: list });

  const pairs = (list) => list.map(([text, value]) => ({ text, value }));

  const addLog = (text, level, tag) => {
    const lvl = LEVELS.includes(level) ? level : 'log';
    const entry = {
      time: Date.now(),
      level: lvl,
      tag: tag || '',
      text: String(text),
      group: groups.join(' > ')
    };
    logs.push(entry);
    if (logs.length > MAX_LOG) logs.shift();
    state.lastLog = entry;
    try {
      const fn = lvl === 'success' ? 'log' : lvl;
      console[fn](`${entry.tag ? `[${entry.tag}] ` : ''}${entry.text}`);
    } catch (e) {}
    renderDebug();
    fire('whenLogged');
  };

  window.addEventListener('error', (e) => recordPageError(e.message || 'Unknown error'));

  window.addEventListener('unhandledrejection', (e) =>
    recordPageError(
      `Unhandled promise rejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`
    )
  );

  class AppConsole {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Console',
        color1: '#64748b',
        color2: '#475569',
        color3: '#334155',
        blocks: [
          label('Console & Log'),
          B('console', {
            opcode: 'logMessage',
            blockType: BT.COMMAND,
            text: 'log [TEXT] as [LEVEL]',
            arguments: { TEXT: str('Something happened'), LEVEL: str('info', 'logLevels') }
          }),
          B('console', {
            opcode: 'logTagged',
            blockType: BT.COMMAND,
            text: 'log [TEXT] as [LEVEL] with tag [TAG]',
            arguments: {
              TEXT: str('Request finished'),
              LEVEL: str('success', 'logLevels'),
              TAG: str('network')
            }
          }),
          B('console', {
            opcode: 'logTable',
            blockType: BT.COMMAND,
            text: 'log table from JSON [JSON]',
            arguments: { JSON: str('[{"name":"Ana","age":20},{"name":"Bob","age":31}]') }
          }),
          B('console', {
            opcode: 'assertLog',
            blockType: BT.COMMAND,
            text: 'assert [CONDITION] otherwise log error [TEXT]',
            arguments: { CONDITION: bool(), TEXT: str('Assertion failed') }
          }),
          B('console', {
            opcode: 'logGroupStart',
            blockType: BT.COMMAND,
            text: 'start log group [NAME]',
            arguments: { NAME: str('Login flow') }
          }),
          B('console', { opcode: 'logGroupEnd', blockType: BT.COMMAND, text: 'end log group' }),
          B('console', { opcode: 'clearLog', blockType: BT.COMMAND, text: 'clear console and log history' }),
          '---',
          B('console', {
            opcode: 'stopwatchStart',
            blockType: BT.COMMAND,
            text: 'start stopwatch [NAME]',
            arguments: { NAME: str('task') }
          }),
          B('console', {
            opcode: 'stopwatchRead',
            blockType: BT.REPORTER,
            text: 'stopwatch [NAME] elapsed (ms)',
            arguments: { NAME: str('task') }
          }),
          B('console', {
            opcode: 'stopwatchStop',
            blockType: BT.COMMAND,
            text: 'stop stopwatch [NAME] and log it',
            arguments: { NAME: str('task') }
          }),
          B('console', {
            opcode: 'countUp',
            blockType: BT.COMMAND,
            text: 'count [LABEL] and log it',
            arguments: { LABEL: str('clicks') }
          }),
          B('console', {
            opcode: 'countOf',
            blockType: BT.REPORTER,
            text: 'count of [LABEL]',
            arguments: { LABEL: str('clicks') }
          }),
          B('console', {
            opcode: 'countReset',
            blockType: BT.COMMAND,
            text: 'reset count [LABEL]',
            arguments: { LABEL: str('clicks') }
          }),
          '---',
          B('console', {
            opcode: 'logHistoryText',
            blockType: BT.REPORTER,
            blockShape: SH.INDENTED,
            text: 'log history as text'
          }),
          B('console', {
            opcode: 'logHistoryJson',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'log history as JSON list'
          }),
          B('console', {
            opcode: 'logEntryJson',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'log entry [N] as JSON object',
            arguments: { N: num(-1) }
          }),
          B('console', {
            opcode: 'lastLogText',
            blockType: BT.REPORTER,
            text: 'last logged [LEVEL] message',
            arguments: { LEVEL: str('any', 'logLevelsAny') }
          }),
          B('console', {
            opcode: 'logCount',
            blockType: BT.REPORTER,
            text: 'number of [LEVEL] log entries',
            arguments: { LEVEL: str('any', 'logLevelsAny') }
          }),
          B('console', {
            opcode: 'downloadLog',
            blockType: BT.COMMAND,
            text: 'download log as file [NAME]',
            arguments: { NAME: str('app-log.txt') }
          }),
          B('console', {
            opcode: 'showDebug',
            blockType: BT.COMMAND,
            text: 'debug console overlay: [STATE]',
            arguments: { STATE: str('on', 'onOffToggle') }
          }),
          B('console', {
            opcode: 'catchErrors',
            blockType: BT.COMMAND,
            text: 'catch page errors into log: [STATE]',
            arguments: { STATE: str('on', 'onOff') }
          }),
          B('console', { opcode: 'lastErrorText', blockType: BT.REPORTER, text: 'last caught error' }),
          B('console', {
            opcode: 'whenLogged',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when a [LEVEL] message is logged',
            arguments: { LEVEL: str('any', 'logLevelsAny') }
          }),
          B('console', {
            opcode: 'whenErrorCaught',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when a page error is caught'
          })
        ],
        menus: {
          onOff: items(
            pairs([
              ['on', 'on'],
              ['off', 'off']
            ])
          ),
          onOffToggle: items(
            pairs([
              ['on', 'on'],
              ['off', 'off'],
              ['toggle', 'toggle']
            ])
          ),
          logLevels: items(pairs(LEVELS.map((l) => [l, l]))),
          logLevelsAny: items(pairs([['any', 'any'], ...LEVELS.map((l) => [l, l])]))
        }
      };
    }

    logMessage({ TEXT, LEVEL }) {
      addLog(Cast.toString(TEXT), Cast.toString(LEVEL), '');
    }

    logTagged({ TEXT, LEVEL, TAG }) {
      addLog(Cast.toString(TEXT), Cast.toString(LEVEL), Cast.toString(TAG));
    }

    logTable({ JSON: json }) {
      const r = parseJsonSafe(json);
      if (!r.ok) {
        addLog('log table: invalid JSON', 'error', 'console');
        return;
      }
      try {
        console.table(r.value);
      } catch (e) {}
      addLog(JSON.stringify(r.value), 'log', 'table');
    }

    assertLog({ CONDITION, TEXT }) {
      if (!Cast.toBoolean(CONDITION)) addLog(Cast.toString(TEXT), 'error', 'assert');
    }

    logGroupStart({ NAME }) {
      const name = Cast.toString(NAME);
      groups.push(name);
      try {
        console.group(name);
      } catch (e) {}
    }

    logGroupEnd() {
      if (groups.length === 0) return;
      groups.pop();
      try {
        console.groupEnd();
      } catch (e) {}
    }

    clearLog() {
      logs.length = 0;
      state.lastLog = null;
      try {
        console.clear();
      } catch (e) {}
      renderDebug();
    }

    stopwatchStart({ NAME }) {
      stopwatches.set(Cast.toString(NAME), performance.now());
    }

    stopwatchRead({ NAME }) {
      const t = stopwatches.get(Cast.toString(NAME));
      return t === undefined ? 0 : Math.round((performance.now() - t) * 100) / 100;
    }

    stopwatchStop({ NAME }) {
      const name = Cast.toString(NAME);
      const t = stopwatches.get(name);
      if (t === undefined) {
        addLog(`Stopwatch "${name}" was never started`, 'warn', 'stopwatch');
        return;
      }
      stopwatches.delete(name);
      addLog(`${name}: ${Math.round((performance.now() - t) * 100) / 100} ms`, 'debug', 'stopwatch');
    }

    countUp({ LABEL }) {
      const l = Cast.toString(LABEL);
      const n = (counters.get(l) || 0) + 1;
      counters.set(l, n);
      addLog(`${l}: ${n}`, 'debug', 'count');
    }

    countOf({ LABEL }) {
      return counters.get(Cast.toString(LABEL)) || 0;
    }

    countReset({ LABEL }) {
      counters.delete(Cast.toString(LABEL));
    }

    logHistoryText() {
      return logs.map(formatEntry).join('\n');
    }

    logHistoryJson() {
      return JSON.stringify(logs);
    }

    logEntryJson({ N }) {
      if (logs.length === 0) return '{}';
      let n = Math.trunc(Cast.toNumber(N));
      if (n === 0) n = -1;
      const index = n > 0 ? n - 1 : logs.length + n;
      const e = logs[index];
      return e ? JSON.stringify(e) : '{}';
    }

    lastLogText({ LEVEL }) {
      const list = entriesOf(Cast.toString(LEVEL));
      return list.length ? list[list.length - 1].text : '';
    }

    logCount({ LEVEL }) {
      return entriesOf(Cast.toString(LEVEL)).length;
    }

    downloadLog({ NAME }) {
      downloadBlob(logs.map(formatEntry).join('\n'), NAME, 'text/plain;charset=utf-8');
    }

    showDebug({ STATE }) {
      const s = Cast.toString(STATE);
      state.debugVisible = s === 'toggle' ? !state.debugVisible : s === 'on';
      if (state.debugVisible) renderDebug();
      else hideDebug();
    }

    catchErrors({ STATE }) {
      state.catchErrors = Cast.toString(STATE) === 'on';
    }

    lastErrorText() {
      return state.lastError;
    }

    whenLogged({ LEVEL }) {
      const l = Cast.toString(LEVEL);
      return !!state.lastLog && (l === 'any' || l === state.lastLog.level);
    }

    whenErrorCaught() {
      return true;
    }
  }

  Scratch.extensions.register(new AppConsole());
})(Scratch);
