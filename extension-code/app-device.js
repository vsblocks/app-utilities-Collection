// Name: App Device
// ID: appdevice
// Description: Device, battery, network, screen and wake lock information.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Device must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appdevice';

  const state = {
    wakeWanted: false,
    wakeSentinel: null
  };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const isMobile = () =>
    /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

  async function requestWakeLock() {
    try {
      if (!navigator.wakeLock) return;
      const lock = await navigator.wakeLock.request('screen');
      state.wakeSentinel = lock;
      lock.addEventListener('release', () => {
        if (state.wakeSentinel === lock) state.wakeSentinel = null;
      });
    } catch (e) {}
  }

  const COLORS = {
    device: ['#14b8a6', '#0d9488', '#0f766e']
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

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.wakeWanted && !state.wakeSentinel) requestWakeLock();
  });

  class AppDevice {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Device',
        color1: '#14b8a6',
        color2: '#0d9488',
        color3: '#0f766e',
        blocks: [
          label('Device'),
          B('device', {
            opcode: 'deviceInfo',
            blockType: BT.REPORTER,
            blockShape: SH.OCTAGONAL,
            text: 'device [INFO]',
            arguments: { INFO: str('language', 'deviceInfos') }
          }),
          B('device', { opcode: 'isOnline', blockType: BT.BOOLEAN, text: 'online?' }),
          B('device', { opcode: 'isDarkMode', blockType: BT.BOOLEAN, text: 'system dark mode?' }),
          B('device', {
            opcode: 'isReducedMotion',
            blockType: BT.BOOLEAN,
            text: 'reduced motion requested?'
          }),
          B('device', { opcode: 'isMobileDevice', blockType: BT.BOOLEAN, text: 'phone or tablet?' }),
          B('device', { opcode: 'isTouch', blockType: BT.BOOLEAN, text: 'has touch screen?' }),
          B('device', { opcode: 'isPortrait', blockType: BT.BOOLEAN, text: 'portrait orientation?' }),
          B('device', { opcode: 'isTabVisible', blockType: BT.BOOLEAN, text: 'tab is visible?' }),
          B('device', { opcode: 'isInstalledApp', blockType: BT.BOOLEAN, text: 'running as installed app?' }),
          B('device', { opcode: 'isEmbedded', blockType: BT.BOOLEAN, text: 'embedded in another page?' }),
          B('device', {
            opcode: 'isSupported',
            blockType: BT.BOOLEAN,
            text: '[FEATURE] supported?',
            arguments: { FEATURE: str('share', 'features') }
          }),
          '---',
          B('device', { opcode: 'batteryLevel', blockType: BT.REPORTER, text: 'battery level (%)' }),
          B('device', { opcode: 'batteryCharging', blockType: BT.BOOLEAN, text: 'battery charging?' }),
          B('device', {
            opcode: 'myLocation',
            blockType: BT.REPORTER,
            blockShape: SH.ARROW,
            text: 'my location [PART]',
            arguments: { PART: str('latitude', 'locationParts') }
          }),
          B('device', {
            opcode: 'vibrate',
            blockType: BT.COMMAND,
            text: 'vibrate for [MS] ms',
            arguments: { MS: num(100) }
          }),
          B('device', {
            opcode: 'vibratePattern',
            blockType: BT.COMMAND,
            text: 'vibrate pattern [PATTERN]',
            arguments: { PATTERN: str('100,50,100') }
          }),
          B('device', {
            opcode: 'setFullscreen',
            blockType: BT.COMMAND,
            text: 'fullscreen: [STATE]',
            arguments: { STATE: str('on', 'onOffToggle') }
          }),
          B('device', { opcode: 'isFullscreen', blockType: BT.BOOLEAN, text: 'fullscreen?' }),
          B('device', {
            opcode: 'setWakeLock',
            blockType: BT.COMMAND,
            text: 'keep screen awake: [STATE]',
            arguments: { STATE: str('on', 'onOff') }
          }),
          B('device', { opcode: 'isAwake', blockType: BT.BOOLEAN, text: 'screen is being kept awake?' })
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
          locationParts: items(
            pairs([
              ['latitude', 'latitude'],
              ['longitude', 'longitude'],
              ['accuracy (m)', 'accuracy']
            ])
          ),
          deviceInfos: items(
            pairs([
              ['language', 'language'],
              ['platform', 'platform'],
              ['time zone', 'timezone'],
              ['screen width', 'screenWidth'],
              ['screen height', 'screenHeight'],
              ['window width', 'windowWidth'],
              ['window height', 'windowHeight'],
              ['pixel ratio', 'pixelRatio'],
              ['CPU cores', 'cores'],
              ['memory (GB)', 'memory'],
              ['connection type', 'network'],
              ['download speed (Mbps)', 'downlink'],
              ['user agent', 'userAgent']
            ])
          ),
          features: items(
            pairs([
              ['sharing', 'share'],
              ['vibration', 'vibrate'],
              ['notifications', 'notifications'],
              ['clipboard', 'clipboard'],
              ['geolocation', 'geolocation'],
              ['wake lock', 'wakelock'],
              ['fullscreen', 'fullscreen'],
              ['speech', 'speech'],
              ['battery', 'battery'],
              ['speech recognition', 'recognition'],
              ['storage', 'storage']
            ])
          )
        }
      };
    }

    deviceInfo({ INFO }) {
      const conn = navigator.connection;
      switch (Cast.toString(INFO)) {
        case 'language':
          return navigator.language || '';
        case 'platform':
          return (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
        case 'timezone':
          return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        case 'screenWidth':
          return screen.width;
        case 'screenHeight':
          return screen.height;
        case 'windowWidth':
          return window.innerWidth;
        case 'windowHeight':
          return window.innerHeight;
        case 'pixelRatio':
          return window.devicePixelRatio || 1;
        case 'cores':
          return navigator.hardwareConcurrency || 0;
        case 'memory':
          return navigator.deviceMemory || 0;
        case 'network':
          return (conn && conn.effectiveType) || '';
        case 'downlink':
          return (conn && conn.downlink) || 0;
        case 'userAgent':
          return navigator.userAgent;
        default:
          return '';
      }
    }

    isOnline() {
      return navigator.onLine;
    }

    isDarkMode() {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    isReducedMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    isMobileDevice() {
      return isMobile();
    }

    isTouch() {
      return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    }

    isPortrait() {
      return window.innerHeight >= window.innerWidth;
    }

    isTabVisible() {
      return !document.hidden;
    }

    isInstalledApp() {
      return !!(
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        navigator.standalone
      );
    }

    isEmbedded() {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    }

    isSupported({ FEATURE }) {
      switch (Cast.toString(FEATURE)) {
        case 'share':
          return !!navigator.share;
        case 'vibrate':
          return !!navigator.vibrate;
        case 'notifications':
          return 'Notification' in window;
        case 'clipboard':
          return !!(navigator.clipboard && navigator.clipboard.writeText);
        case 'geolocation':
          return 'geolocation' in navigator;
        case 'wakelock':
          return 'wakeLock' in navigator;
        case 'fullscreen':
          return !!document.fullscreenEnabled;
        case 'speech':
          return 'speechSynthesis' in window;
        case 'battery':
          return 'getBattery' in navigator;
        case 'recognition':
          return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        case 'storage':
          try {
            localStorage.setItem('__apputils_test', '1');
            localStorage.removeItem('__apputils_test');
            return true;
          } catch (e) {
            return false;
          }
        default:
          return false;
      }
    }

    async batteryLevel() {
      try {
        const b = await navigator.getBattery();
        return Math.round(b.level * 100);
      } catch (e) {
        return -1;
      }
    }

    async batteryCharging() {
      try {
        const b = await navigator.getBattery();
        return !!b.charging;
      } catch (e) {
        return false;
      }
    }

    myLocation({ PART }) {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve('');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const part = Cast.toString(PART);
            if (part === 'longitude') resolve(pos.coords.longitude);
            else if (part === 'accuracy') resolve(pos.coords.accuracy);
            else resolve(pos.coords.latitude);
          },
          () => resolve(''),
          { timeout: 10000, maximumAge: 30000 }
        );
      });
    }

    vibrate({ MS }) {
      try {
        if (navigator.vibrate) navigator.vibrate(clamp(Cast.toNumber(MS), 0, 5000));
      } catch (e) {}
    }

    vibratePattern({ PATTERN }) {
      try {
        const pattern = Cast.toString(PATTERN)
          .split(',')
          .map((x) => clamp(Number(x.trim()) || 0, 0, 2000))
          .slice(0, 20);
        if (navigator.vibrate) navigator.vibrate(pattern);
      } catch (e) {}
    }

    async setFullscreen({ STATE }) {
      try {
        const s = Cast.toString(STATE);
        const wantOn = s === 'toggle' ? !document.fullscreenElement : s === 'on';
        if (wantOn) {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        } else if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (e) {}
    }

    isFullscreen() {
      return !!document.fullscreenElement;
    }

    async setWakeLock({ STATE }) {
      if (Cast.toString(STATE) === 'on') {
        state.wakeWanted = true;
        if (!state.wakeSentinel) await requestWakeLock();
      } else {
        state.wakeWanted = false;
        const lock = state.wakeSentinel;
        state.wakeSentinel = null;
        try {
          if (lock && lock.release) await lock.release();
        } catch (e) {}
      }
    }

    isAwake() {
      return !!state.wakeSentinel;
    }
  }

  Scratch.extensions.register(new AppDevice());
})(Scratch);
