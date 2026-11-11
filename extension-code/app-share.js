// Name: App Share
// ID: appshare
// Description: Clipboard, sharing, notifications, files, speech synthesis and recognition, stage screenshots.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Share must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appshare';

  const state = {
    lastFile: { name: '', size: 0, type: '' },
    lastNotificationClicked: ''
  };

  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const isSafeUrl = (url) => /^(https?:|mailto:|tel:)/i.test(url);

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

  const pickFile = (accept, mode) =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      const done = (v) => {
        input.remove();
        resolve(v);
      };
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        if (!f) return done('');
        if (f.size > MAX_FILE_BYTES) {
          addLog(`File "${f.name}" is larger than 25 MB and was ignored.`, 'warn', 'files');
          return done('');
        }
        state.lastFile = { name: f.name, size: f.size, type: f.type };
        const r = new FileReader();
        r.onload = () => done(String(r.result));
        r.onerror = () => done('');
        if (mode === 'dataurl') r.readAsDataURL(f);
        else r.readAsText(f);
        return undefined;
      });
      input.addEventListener('cancel', () => done(''));
      document.body.appendChild(input);
      input.click();
    });

  const speakText = (text, voiceName, rate) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis || !text) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find((x) => x.name === voiceName);
      if (v) u.voice = v;
      u.rate = clamp(rate || 1, 0.1, 10);
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });

  const COLORS = {
    share: ['#06b6d4', '#0891b2', '#0e7490']
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
    fn.call(console, `[App Share] ${text}`);
  };

  class AppShare {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Share',
        color1: '#06b6d4',
        color2: '#0891b2',
        color3: '#0e7490',
        blocks: [
          label('Share, Files & Speech'),
          B('share', {
            opcode: 'copyText',
            blockType: BT.COMMAND,
            text: 'copy [TEXT] to clipboard',
            arguments: { TEXT: str('text') }
          }),
          B('share', {
            opcode: 'readClipboard',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'clipboard text'
          }),
          B('share', {
            opcode: 'shareContent',
            blockType: BT.COMMAND,
            text: 'share title [TITLE] text [TEXT] link [URL]',
            arguments: { TITLE: str('My App'), TEXT: str('Check this out!'), URL: str('') }
          }),
          B('share', {
            opcode: 'downloadText',
            blockType: BT.COMMAND,
            text: 'download [TEXT] as file [NAME]',
            arguments: { TEXT: str('file content'), NAME: str('file.txt') }
          }),
          B('share', {
            opcode: 'downloadUrl',
            blockType: BT.COMMAND,
            text: 'download data from URL [URL] as [NAME]',
            arguments: { URL: str('data:text/plain;base64,SGVsbG8='), NAME: str('hello.txt') }
          }),
          B('share', {
            opcode: 'pickTextFile',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'choose a text file'
          }),
          B('share', {
            opcode: 'pickImageFile',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'choose an image (data URL)'
          }),
          B('share', {
            opcode: 'pickAnyFile',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'choose any file (data URL)'
          }),
          B('share', {
            opcode: 'lastFileInfo',
            blockType: BT.REPORTER,
            text: 'last chosen file [PART]',
            arguments: { PART: str('name', 'fileParts') }
          }),
          '---',
          B('share', {
            opcode: 'notificationPermission',
            blockType: BT.REPORTER,
            text: 'notification permission'
          }),
          B('share', {
            opcode: 'requestNotifications',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'ask for notification permission'
          }),
          B('share', {
            opcode: 'notify',
            blockType: BT.COMMAND,
            text: 'send notification [TITLE] message [BODY]',
            arguments: { TITLE: str('My App'), BODY: str('You have a new message') }
          }),
          B('share', {
            opcode: 'lastNotificationClicked',
            blockType: BT.REPORTER,
            text: 'last clicked notification title'
          }),
          '---',
          B('share', {
            opcode: 'speak',
            blockType: BT.COMMAND,
            text: 'speak [TEXT] voice [VOICE] rate [RATE]',
            arguments: { TEXT: str('Hello from my app'), VOICE: str('default', 'voices'), RATE: num(1) }
          }),
          B('share', {
            opcode: 'speakWait',
            blockType: BT.COMMAND,
            text: 'speak [TEXT] voice [VOICE] rate [RATE] and wait',
            arguments: { TEXT: str('Hello from my app'), VOICE: str('default', 'voices'), RATE: num(1) }
          }),
          B('share', { opcode: 'stopSpeaking', blockType: BT.COMMAND, text: 'stop speaking' }),
          B('share', { opcode: 'isSpeaking', blockType: BT.BOOLEAN, text: 'speaking?' }),
          B('share', {
            opcode: 'listenSpeech',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'listen and transcribe speech in [LANG]',
            arguments: { LANG: str('en-US') }
          }),
          '---',
          B('share', {
            opcode: 'stageSnapshot',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'stage screenshot (data URL)'
          }),
          B('share', {
            opcode: 'downloadStage',
            blockType: BT.COMMAND,
            text: 'download stage screenshot as [NAME]',
            arguments: { NAME: str('screenshot.png') }
          })
        ],
        menus: {
          fileParts: items(
            pairs([
              ['name', 'name'],
              ['size (bytes)', 'size'],
              ['type', 'type']
            ])
          ),
          voices: { acceptReporters: true, items: 'getVoices' }
        }
      };
    }

    getVoices() {
      const list = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      return [
        { text: 'default', value: 'default' },
        ...list.map((v) => ({ text: `${v.name} (${v.lang})`, value: v.name }))
      ];
    }

    async copyText({ TEXT }) {
      const text = Cast.toString(TEXT);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        } catch (e2) {}
      }
    }

    async readClipboard() {
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        return '';
      }
    }

    async shareContent({ TITLE, TEXT, URL: link }) {
      if (!navigator.share) return;
      const data = {};
      const title = Cast.toString(TITLE);
      const text = Cast.toString(TEXT);
      const url = Cast.toString(link).trim();
      if (title) data.title = title;
      if (text) data.text = text;
      if (url && isSafeUrl(url)) data.url = url;
      try {
        await navigator.share(data);
      } catch (e) {}
    }

    downloadText({ TEXT, NAME }) {
      downloadBlob(Cast.toString(TEXT), NAME, 'text/plain;charset=utf-8');
    }

    downloadUrl({ URL: link, NAME }) {
      const u = Cast.toString(link).trim();
      if (!/^(data:|blob:|https:)/i.test(u)) return;
      const a = document.createElement('a');
      a.href = u;
      a.download = Cast.toString(NAME).replace(/[\\/:*?"<>|]/g, '_') || 'file';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    pickTextFile() {
      return pickFile('.txt,.json,.csv,.md,.html,.js,.xml,text/*', 'text');
    }

    pickImageFile() {
      return pickFile('image/*', 'dataurl');
    }

    pickAnyFile() {
      return pickFile('*/*', 'dataurl');
    }

    lastFileInfo({ PART }) {
      const p = Cast.toString(PART);
      if (p === 'size') return state.lastFile.size;
      if (p === 'type') return state.lastFile.type;
      return state.lastFile.name;
    }

    notificationPermission() {
      return 'Notification' in window ? Notification.permission : 'unsupported';
    }

    async requestNotifications() {
      if (!('Notification' in window)) return 'unsupported';
      try {
        return await Notification.requestPermission();
      } catch (e) {
        return 'denied';
      }
    }

    notify({ TITLE, BODY }) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const title = Cast.toString(TITLE);
      try {
        const n = new Notification(title, { body: Cast.toString(BODY) });
        n.onclick = () => {
          state.lastNotificationClicked = title;
          try {
            window.focus();
          } catch (e) {}
          fire('whenNotificationClicked');
          n.close();
        };
      } catch (e) {}
    }

    lastNotificationClicked() {
      return state.lastNotificationClicked;
    }

    speak({ TEXT, VOICE, RATE }) {
      speakText(Cast.toString(TEXT), Cast.toString(VOICE), Cast.toNumber(RATE));
    }

    speakWait({ TEXT, VOICE, RATE }) {
      return speakText(Cast.toString(TEXT), Cast.toString(VOICE), Cast.toNumber(RATE));
    }

    stopSpeaking() {
      try {
        if (window.speechSynthesis) speechSynthesis.cancel();
      } catch (e) {}
    }

    isSpeaking() {
      return !!(window.speechSynthesis && speechSynthesis.speaking);
    }

    listenSpeech({ LANG }) {
      return new Promise((resolve) => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          resolve('');
          return;
        }
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          resolve(v);
        };
        try {
          const r = new SR();
          r.lang = Cast.toString(LANG).trim() || navigator.language || 'en-US';
          r.interimResults = false;
          r.maxAlternatives = 1;
          r.onresult = (e) => finish(e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '');
          r.onerror = () => finish('');
          r.onend = () => finish('');
          r.start();
          setTimeout(() => {
            try {
              r.stop();
            } catch (e) {}
            finish('');
          }, 15000);
        } catch (e) {
          finish('');
        }
      });
    }

    stageSnapshot() {
      return new Promise((resolve) => {
        const renderer = runtime.renderer;
        if (!renderer || !renderer.requestSnapshot) {
          resolve('');
          return;
        }
        renderer.requestSnapshot((uri) => resolve(uri || ''));
        renderer.draw();
      });
    }

    async downloadStage({ NAME }) {
      const uri = await this.stageSnapshot();
      if (!uri) return;
      const a = document.createElement('a');
      a.href = uri;
      a.download = Cast.toString(NAME).replace(/[\\/:*?"<>|]/g, '_') || 'screenshot.png';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  Scratch.extensions.register(new AppShare());
})(Scratch);
