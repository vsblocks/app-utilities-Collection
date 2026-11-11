// Name: App Storage
// ID: appstorage
// Description: Namespaced local and session storage with expiry, JSON import and export.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Storage must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appstorage';

  const state = {
    appId: 'my-app',
    storageType: 'local'
  };

  const STORAGE_PREFIX = 'penguinmod-apputils:';

  const getStore = () => (state.storageType === 'session' ? sessionStorage : localStorage);

  const keyPrefix = () => `${STORAGE_PREFIX}${state.appId}:`;

  const readEntry = (key) => {
    const store = getStore();
    const fullKey = keyPrefix() + key;
    const raw = store.getItem(fullKey);
    if (raw === null) return null;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && o.__au === 1) {
        if (o.e && o.e < Date.now()) {
          store.removeItem(fullKey);
          return null;
        }
        return o.v;
      }
    } catch (e) {}
    return raw;
  };

  const writeEntry = (key, value, expiresInSecs) => {
    try {
      getStore().setItem(
        keyPrefix() + key,
        JSON.stringify({ __au: 1, v: value, e: expiresInSecs > 0 ? Date.now() + expiresInSecs * 1000 : 0 })
      );
    } catch (e) {
      addLog(`Could not save "${key}": ${e && e.message ? e.message : e}`, 'error', 'storage');
    }
  };

  const storedKeys = () => {
    const prefix = keyPrefix();
    const store = getStore();
    const keys = [];
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(prefix)) {
          const name = k.slice(prefix.length);
          if (readEntry(name) !== null) keys.push(name);
        }
      }
    } catch (e) {}
    return keys;
  };

  const parseJsonSafe = (text) => {
    try {
      return { ok: true, value: JSON.parse(Cast.toString(text)) };
    } catch (e) {
      return { ok: false, value: undefined };
    }
  };

  const COLORS = {
    storage: ['#f59e0b', '#d97706', '#b45309']
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
    fn.call(console, `[App Storage] ${text}`);
  };

  class AppStorage {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Storage',
        color1: '#f59e0b',
        color2: '#d97706',
        color3: '#b45309',
        blocks: [
          label('Storage'),
          B('storage', {
            opcode: 'setAppId',
            blockType: BT.COMMAND,
            text: 'set app ID to [ID]',
            arguments: { ID: str('my-app') }
          }),
          B('storage', {
            opcode: 'setStorageType',
            blockType: BT.COMMAND,
            text: 'use [TYPE] storage',
            arguments: { TYPE: str('local', 'storageTypes') }
          }),
          B('storage', {
            opcode: 'saveValue',
            blockType: BT.COMMAND,
            text: 'save [VALUE] to [KEY]',
            arguments: { VALUE: str('value'), KEY: str('key') }
          }),
          B('storage', {
            opcode: 'saveValueExpiring',
            blockType: BT.COMMAND,
            text: 'save [VALUE] to [KEY] for [SECS] seconds',
            arguments: { VALUE: str('value'), KEY: str('session-token'), SECS: num(3600) }
          }),
          B('storage', {
            opcode: 'loadValue',
            blockType: BT.REPORTER,
            blockShape: SH.BUMPED,
            text: 'load [KEY] default [DEFAULT]',
            arguments: { KEY: str('key'), DEFAULT: str('') }
          }),
          B('storage', {
            opcode: 'hasValue',
            blockType: BT.BOOLEAN,
            text: '[KEY] is saved?',
            arguments: { KEY: str('key') }
          }),
          B('storage', {
            opcode: 'deleteValue',
            blockType: BT.COMMAND,
            text: 'delete [KEY]',
            arguments: { KEY: str('key') }
          }),
          B('storage', {
            opcode: 'allKeys',
            blockType: BT.REPORTER,
            blockShape: SH.SQUARE,
            text: 'all saved keys as JSON list'
          }),
          B('storage', { opcode: 'keyCount', blockType: BT.REPORTER, text: 'number of saved keys' }),
          B('storage', {
            opcode: 'exportAll',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'export all data as JSON object'
          }),
          B('storage', {
            opcode: 'importAll',
            blockType: BT.COMMAND,
            text: 'import data from JSON object [JSON]',
            arguments: { JSON: str('{"theme":"dark"}') }
          }),
          B('storage', {
            opcode: 'storageUsed',
            blockType: BT.REPORTER,
            text: 'storage used by this app (KB)'
          }),
          B('storage', { opcode: 'clearAll', blockType: BT.COMMAND, text: 'delete everything of this app' })
        ],
        menus: {
          storageTypes: items(
            pairs([
              ['persistent (local)', 'local'],
              ['session only', 'session']
            ])
          )
        }
      };
    }

    setAppId({ ID }) {
      const id = Cast.toString(ID).trim();
      if (id) state.appId = id;
    }

    setStorageType({ TYPE }) {
      state.storageType = Cast.toString(TYPE) === 'session' ? 'session' : 'local';
    }

    saveValue({ VALUE, KEY }) {
      writeEntry(Cast.toString(KEY), Cast.toString(VALUE), 0);
    }

    saveValueExpiring({ VALUE, KEY, SECS }) {
      writeEntry(Cast.toString(KEY), Cast.toString(VALUE), Math.max(1, Cast.toNumber(SECS)));
    }

    loadValue({ KEY, DEFAULT }) {
      try {
        const v = readEntry(Cast.toString(KEY));
        return v === null ? Cast.toString(DEFAULT) : v;
      } catch (e) {
        return Cast.toString(DEFAULT);
      }
    }

    hasValue({ KEY }) {
      try {
        return readEntry(Cast.toString(KEY)) !== null;
      } catch (e) {
        return false;
      }
    }

    deleteValue({ KEY }) {
      try {
        getStore().removeItem(keyPrefix() + Cast.toString(KEY));
      } catch (e) {}
    }

    allKeys() {
      return JSON.stringify(storedKeys());
    }

    keyCount() {
      return storedKeys().length;
    }

    exportAll() {
      const out = {};
      storedKeys().forEach((k) => {
        out[k] = readEntry(k);
      });
      return JSON.stringify(out);
    }

    importAll({ JSON: json }) {
      const r = parseJsonSafe(json);
      if (!r.ok || !r.value || typeof r.value !== 'object' || Array.isArray(r.value)) {
        addLog('import: expected a JSON object', 'error', 'storage');
        return;
      }
      Object.keys(r.value).forEach((k) => {
        const v = r.value[k];
        writeEntry(k, typeof v === 'string' ? v : JSON.stringify(v), 0);
      });
    }

    storageUsed() {
      const prefix = keyPrefix();
      const store = getStore();
      let chars = 0;
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(prefix)) chars += k.length + (store.getItem(k) || '').length;
        }
      } catch (e) {}
      return Math.round(((chars * 2) / 1024) * 100) / 100;
    }

    clearAll() {
      const prefix = keyPrefix();
      const store = getStore();
      try {
        const remove = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(prefix)) remove.push(k);
        }
        remove.forEach((k) => store.removeItem(k));
      } catch (e) {}
    }
  }

  Scratch.extensions.register(new AppStorage());
})(Scratch);
