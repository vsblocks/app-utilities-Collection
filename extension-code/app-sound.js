// Name: App Sound
// ID: appsound
// Description: Tones, notes, melodies and UI sounds generated with WebAudio.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Sound must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const EXT_ID = 'appsound';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  let audioCtx = null;

  const getAudio = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  const playTone = (freq, ms, wave, volume, delayMs) =>
    new Promise((resolve) => {
      try {
        const ctx = getAudio();
        if (!ctx) {
          resolve();
          return;
        }
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const dur = clamp(ms, 10, 10000) / 1000;
        const t0 = ctx.currentTime + (delayMs || 0) / 1000;
        const vol = (clamp(volume, 0, 100) / 100) * 0.3;
        o.type = ['sine', 'square', 'triangle', 'sawtooth'].includes(wave) ? wave : 'sine';
        o.frequency.value = clamp(freq, 20, 20000);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
        g.gain.setValueAtTime(vol, Math.max(t0 + 0.01, t0 + dur - 0.04));
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
        o.onended = () => resolve();
      } catch (e) {
        resolve();
      }
    });

  const NOTE_INDEX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  const noteFreq = (note) => {
    const m = Cast.toString(note)
      .trim()
      .toLowerCase()
      .match(/^([a-g])(#|b|s)?(-?\d)?$/);
    if (!m) return 0;
    let semi = NOTE_INDEX[m[1]];
    if (m[2] === '#' || m[2] === 's') semi += 1;
    else if (m[2] === 'b') semi -= 1;
    const octave = m[3] === undefined ? 4 : Number(m[3]);
    return 440 * Math.pow(2, (semi - 9 + (octave - 4) * 12) / 12);
  };

  const UI_SOUNDS = {
    click: [[880, 40]],
    pop: [
      [520, 50],
      [780, 60]
    ],
    success: [
      [523, 90],
      [659, 90],
      [784, 160]
    ],
    error: [
      [330, 140],
      [220, 260]
    ],
    notify: [
      [784, 110],
      [988, 190]
    ]
  };

  const COLORS = {
    sound: ['#eab308', '#ca8a04', '#a16207']
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

  class AppSound {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Sound',
        color1: '#eab308',
        color2: '#ca8a04',
        color3: '#a16207',
        blocks: [
          label('Sound'),
          B('sound', {
            opcode: 'playTone',
            blockType: BT.COMMAND,
            text: 'play tone [FREQ] Hz for [MS] ms wave [WAVE] volume [VOL]%',
            arguments: { FREQ: num(440), MS: num(300), WAVE: str('sine', 'waveTypes'), VOL: num(60) }
          }),
          B('sound', {
            opcode: 'playNote',
            blockType: BT.COMMAND,
            text: 'play note [NOTE] for [MS] ms wave [WAVE]',
            arguments: { NOTE: str('C#4'), MS: num(300), WAVE: str('triangle', 'waveTypes') }
          }),
          B('sound', {
            opcode: 'playMelody',
            blockType: BT.COMMAND,
            text: 'play melody [NOTES] note length [MS] ms and wait',
            arguments: { NOTES: str('C4 E4 G4 C5 - G4 C5'), MS: num(200) }
          }),
          B('sound', {
            opcode: 'uiSound',
            blockType: BT.COMMAND,
            text: 'play UI sound [SOUND]',
            arguments: { SOUND: str('success', 'uiSounds') }
          }),
          B('sound', {
            opcode: 'noteFrequency',
            blockType: BT.REPORTER,
            text: 'frequency of note [NOTE] (Hz)',
            arguments: { NOTE: str('A4') }
          })
        ],
        menus: {
          waveTypes: items(
            pairs([
              ['sine', 'sine'],
              ['square', 'square'],
              ['triangle', 'triangle'],
              ['sawtooth', 'sawtooth']
            ])
          ),
          uiSounds: items(pairs(['click', 'pop', 'success', 'error', 'notify'].map((x) => [x, x])))
        }
      };
    }

    playTone({ FREQ, MS, WAVE, VOL }) {
      playTone(Cast.toNumber(FREQ), Cast.toNumber(MS), Cast.toString(WAVE), Cast.toNumber(VOL), 0);
    }

    playNote({ NOTE, MS, WAVE }) {
      const f = noteFreq(NOTE);
      if (f > 0) playTone(f, Cast.toNumber(MS), Cast.toString(WAVE), 60, 0);
    }

    async playMelody({ NOTES, MS }) {
      const step = clamp(Cast.toNumber(MS), 30, 2000);
      const tokens = Cast.toString(NOTES).trim().split(/\s+/).filter(Boolean).slice(0, 128);
      tokens.forEach((tok, i) => {
        const f = noteFreq(tok);
        if (f > 0) playTone(f, step * 0.92, 'triangle', 60, i * step);
      });
      await new Promise((r) => setTimeout(r, tokens.length * step));
    }

    uiSound({ SOUND }) {
      const seq = UI_SOUNDS[Cast.toString(SOUND)];
      if (!seq) return;
      let t = 0;
      seq.forEach(([f, ms]) => {
        playTone(f, ms, 'sine', 55, t);
        t += ms;
      });
    }

    noteFrequency({ NOTE }) {
      return Math.round(noteFreq(NOTE) * 100) / 100;
    }
  }

  Scratch.extensions.register(new AppSound());
})(Scratch);
