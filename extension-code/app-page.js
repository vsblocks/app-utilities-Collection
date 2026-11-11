// Name: App Page
// ID: apppage
// Description: Page title, URL, hash, links and leave confirmation.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Page must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const EXT_ID = 'apppage';

  const state = {
    confirmLeave: false
  };

  const safeColor = (c, fallback) => {
    const s = Cast.toString(c).trim();
    try {
      if (window.CSS && CSS.supports('color', s)) return s;
    } catch (e) {}
    return fallback === undefined ? '#8b5cf6' : fallback;
  };

  const isSafeUrl = (url) => /^(https?:|mailto:|tel:)/i.test(url);

  const openLink = async (url, where) => {
    if (!isSafeUrl(url)) return;
    try {
      if (where === 'same') {
        if (Scratch.canRedirect && Scratch.redirect) {
          if (await Scratch.canRedirect(url)) await Scratch.redirect(url);
        } else {
          location.href = url;
        }
      } else if (Scratch.canOpenWindow && Scratch.openWindow) {
        if (await Scratch.canOpenWindow(url)) await Scratch.openWindow(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {}
  };

  const COLORS = {
    page: ['#3b82f6', '#2563eb', '#1d4ed8']
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

  const color = (defaultValue) => ({ type: AT.COLOR, defaultValue });

  const items = (list) => ({ acceptReporters: true, items: list });

  const pairs = (list) => list.map(([text, value]) => ({ text, value }));

  window.addEventListener('beforeunload', (e) => {
    if (state.confirmLeave) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
    return undefined;
  });

  class AppPage {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Page',
        color1: '#3b82f6',
        color2: '#2563eb',
        color3: '#1d4ed8',
        blocks: [
          label('Page & URL'),
          B('page', {
            opcode: 'setTabTitle',
            blockType: BT.COMMAND,
            text: 'set tab title to [TITLE]',
            arguments: { TITLE: str('My App') }
          }),
          B('page', { opcode: 'getTabTitle', blockType: BT.REPORTER, text: 'tab title' }),
          B('page', {
            opcode: 'setFavicon',
            blockType: BT.COMMAND,
            text: 'set tab icon from URL [URL]',
            arguments: { URL: str('https://') }
          }),
          B('page', {
            opcode: 'setThemeColor',
            blockType: BT.COMMAND,
            text: 'set browser bar color to [COLOR]',
            arguments: { COLOR: color('#8b5cf6') }
          }),
          B('page', {
            opcode: 'setHash',
            blockType: BT.COMMAND,
            text: 'set URL hash to [PAGE]',
            arguments: { PAGE: str('home') }
          }),
          B('page', { opcode: 'getHash', blockType: BT.REPORTER, text: 'URL hash' }),
          B('page', {
            opcode: 'historyGo',
            blockType: BT.COMMAND,
            text: 'browser history: [DIR]',
            arguments: { DIR: str('back', 'historyDirs') }
          }),
          B('page', { opcode: 'currentUrl', blockType: BT.REPORTER, text: 'current URL' }),
          B('page', {
            opcode: 'urlParam',
            blockType: BT.REPORTER,
            text: 'URL parameter [NAME]',
            arguments: { NAME: str('id') }
          }),
          B('page', {
            opcode: 'setUrlParam',
            blockType: BT.COMMAND,
            text: 'set URL parameter [NAME] to [VALUE]',
            arguments: { NAME: str('id'), VALUE: str('42') }
          }),
          B('page', {
            opcode: 'removeUrlParam',
            blockType: BT.COMMAND,
            text: 'remove URL parameter [NAME]',
            arguments: { NAME: str('id') }
          }),
          B('page', {
            opcode: 'clearUrlParams',
            blockType: BT.COMMAND,
            text: 'remove all URL parameters'
          }),
          B('page', {
            opcode: 'openUrl',
            blockType: BT.COMMAND,
            text: 'open [LINK] in [WHERE]',
            arguments: { LINK: str('https://penguinmod.com'), WHERE: str('new', 'openWhere') }
          }),
          B('page', {
            opcode: 'confirmLeave',
            blockType: BT.COMMAND,
            text: 'ask before closing the app: [STATE]',
            arguments: { STATE: str('on', 'onOff') }
          }),
          B('page', { opcode: 'printPage', blockType: BT.COMMAND, text: 'print page' }),
          B('page', {
            opcode: 'reloadPage',
            blockType: BT.COMMAND,
            text: 'ask to reload page'
          })
        ],
        menus: {
          onOff: items(
            pairs([
              ['on', 'on'],
              ['off', 'off']
            ])
          ),
          historyDirs: items(
            pairs([
              ['back', 'back'],
              ['forward', 'forward']
            ])
          ),
          openWhere: items(
            pairs([
              ['new tab', 'new'],
              ['this tab', 'same']
            ])
          )
        }
      };
    }

    setTabTitle({ TITLE }) {
      document.title = Cast.toString(TITLE);
    }

    getTabTitle() {
      return document.title;
    }

    setFavicon({ URL: url }) {
      const u = Cast.toString(url).trim();
      if (!/^(https?:|data:image\/)/i.test(u)) return;
      let link = document.querySelector('link[rel~="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = u;
    }

    setThemeColor({ COLOR }) {
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = safeColor(COLOR, '#8b5cf6');
    }

    setHash({ PAGE }) {
      try {
        location.hash = Cast.toString(PAGE).replace(/^#/, '');
      } catch (e) {}
    }

    getHash() {
      try {
        return decodeURIComponent(location.hash.replace(/^#/, ''));
      } catch (e) {
        return location.hash.replace(/^#/, '');
      }
    }

    historyGo({ DIR }) {
      try {
        if (Cast.toString(DIR) === 'forward') history.forward();
        else history.back();
      } catch (e) {}
    }

    currentUrl() {
      return location.href;
    }

    urlParam({ NAME }) {
      try {
        return new URL(location.href).searchParams.get(Cast.toString(NAME)) || '';
      } catch (e) {
        return '';
      }
    }

    setUrlParam({ NAME, VALUE }) {
      try {
        const u = new URL(location.href);
        const v = Cast.toString(VALUE);
        if (v === '') u.searchParams.delete(Cast.toString(NAME));
        else u.searchParams.set(Cast.toString(NAME), v);
        history.replaceState(null, '', u);
      } catch (e) {}
    }

    removeUrlParam({ NAME }) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete(Cast.toString(NAME));
        history.replaceState(null, '', u);
      } catch (e) {}
    }

    clearUrlParams() {
      try {
        const u = new URL(location.href);
        u.search = '';
        history.replaceState(null, '', u);
      } catch (e) {}
    }

    openUrl({ LINK, WHERE }) {
      return openLink(Cast.toString(LINK).trim(), Cast.toString(WHERE));
    }

    confirmLeave({ STATE }) {
      state.confirmLeave = Cast.toString(STATE) === 'on';
    }

    printPage() {
      try {
        window.print();
      } catch (e) {}
    }

    reloadPage() {
      let ok = false;
      try {
        ok = window.confirm('Do you want to reload the page?');
      } catch (e) {}
      if (!ok) return;
      state.confirmLeave = false;
      location.reload();
    }
  }

  Scratch.extensions.register(new AppPage());
})(Scratch);