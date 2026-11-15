// Name: App Sound
// ID: appsound
// Description: Tones, notes, melodies, MIDI and UI sounds generated with WebAudio.
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

  const WAVES = ['sine', 'square', 'triangle', 'sawtooth'];

  const waveOf = (w, fallback) => {
    const s = Cast.toString(w);
    return WAVES.includes(s) ? s : fallback || 'sine';
  };

  let audioCtx = null;

  // osciladores de tons/melodias ativos e players de MIDI ativos (para poder parar tudo)
  const activeNodes = new Set();
  const players = new Set();

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
        o.type = WAVES.includes(wave) ? wave : 'sine';
        o.frequency.value = clamp(freq, 20, 20000);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
        g.gain.setValueAtTime(vol, Math.max(t0 + 0.01, t0 + dur - 0.04));
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(ctx.destination);
        activeNodes.add(o);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
        o.onended = () => {
          activeNodes.delete(o);
          try {
            g.disconnect();
          } catch (e) {}
          resolve();
        };
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

  // agenda a melodia (sem esperar) e devolve a duração total em ms
  const melody = (notes, ms) => {
    const step = clamp(ms, 30, 2000);
    const tokens = Cast.toString(notes).trim().split(/\s+/).filter(Boolean).slice(0, 128);
    tokens.forEach((tok, i) => {
      const f = noteFreq(tok);
      if (f > 0) playTone(f, step * 0.92, 'triangle', 60, i * step);
    });
    return tokens.length * step;
  };

  // ---------------------------------------------------------------------------
  // MIDI
  // ---------------------------------------------------------------------------

  const bytesToBase64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };

  const base64ToBytes = (text) => {
    let b = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  // aceita: base64, data:audio/midi;base64,..., hex ("4D 54 68 64 ...") ou uma URL http(s)
  const readBytes = async (input) => {
    let s = input;
    if (/^https?:\/\//i.test(s)) {
      if (!(await Scratch.canFetch(s))) throw new Error('Sem permissão para baixar essa URL');
      const res = await Scratch.fetch(s);
      return new Uint8Array(await res.arrayBuffer());
    }
    const comma = s.indexOf(',');
    if (/^data:/i.test(s) && comma >= 0) s = s.slice(comma + 1);
    s = s.replace(/\s+/g, '');
    if (/^(0x)?4d546864[0-9a-f]*$/i.test(s) && s.replace(/^0x/i, '').length % 2 === 0) {
      const hex = s.replace(/^0x/i, '');
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
      return out;
    }
    return base64ToBytes(s);
  };

  // lê um arquivo .mid (formato 0 ou 1) e devolve as notas já em segundos
  const parseMidi = (bytes) => {
    const len = bytes.length;
    if (
      len < 14 ||
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'MThd'
    ) {
      throw new Error('Não é um arquivo MIDI (faltou o cabeçalho MThd)');
    }
    const u16 = (o) => (bytes[o] << 8) | bytes[o + 1];
    const u32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;

    let division = u16(12);
    if (!division || division & 0x8000) division = 480; // SMPTE não é suportado
    const raw = [];
    const tempos = [];

    const parseTrack = (start, end) => {
      let i = start;
      let tick = 0;
      let running = 0;
      const open = new Map();
      const readVar = () => {
        let v = 0;
        let b;
        do {
          b = bytes[i++];
          v = (v << 7) | (b & 0x7f);
        } while (b & 0x80 && i < end);
        return v;
      };
      while (i < end) {
        tick += readVar();
        let st = bytes[i];
        if (st === undefined) break;
        if (st & 0x80) {
          i++;
          if (st < 0xf0) running = st;
          else running = 0;
        } else {
          st = running;
        }
        if (!st) break;
        if (st === 0xff) {
          const type = bytes[i++];
          const size = readVar();
          if (type === 0x51 && size === 3) {
            const uspq = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
            if (uspq > 0) tempos.push({ tick, uspq });
          }
          i += size;
          if (type === 0x2f) break;
        } else if (st === 0xf0 || st === 0xf7) {
          i += readVar();
        } else {
          const hi = st & 0xf0;
          const ch = st & 0x0f;
          if (hi === 0xc0 || hi === 0xd0) {
            i += 1;
          } else {
            const a = bytes[i++];
            const b = bytes[i++];
            const key = ch * 128 + a;
            if (hi === 0x90 && b > 0) {
              if (!open.has(key)) open.set(key, []);
              open.get(key).push({ tick, vel: b });
            } else if (hi === 0x80 || hi === 0x90) {
              const stack = open.get(key);
              if (stack && stack.length) {
                const n = stack.shift();
                raw.push({ tick: n.tick, end: tick, note: a, vel: n.vel, ch });
              }
            }
          }
        }
      }
      open.forEach((stack, key) => {
        stack.forEach((n) => {
          raw.push({ tick: n.tick, end: tick, note: key % 128, vel: n.vel, ch: Math.floor(key / 128) });
        });
      });
    };

    let p = 8 + u32(4);
    while (p + 8 <= len) {
      const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
      const size = u32(p + 4);
      const start = p + 8;
      if (id === 'MTrk') parseTrack(start, Math.min(len, start + size));
      p = start + size;
    }

    // mapa de tempo: ticks -> segundos
    tempos.sort((a, b) => a.tick - b.tick);
    const segs = [{ tick: 0, sec: 0, spt: 500000 / 1e6 / division }];
    tempos.forEach((tp) => {
      const last = segs[segs.length - 1];
      const spt = tp.uspq / 1e6 / division;
      if (tp.tick === last.tick) {
        last.spt = spt;
        return;
      }
      segs.push({ tick: tp.tick, sec: last.sec + (tp.tick - last.tick) * last.spt, spt });
    });
    const toSec = (tick) => {
      let lo = 0;
      let hi = segs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segs[mid].tick <= tick) lo = mid;
        else hi = mid - 1;
      }
      return segs[lo].sec + (tick - segs[lo].tick) * segs[lo].spt;
    };

    raw.sort((a, b) => a.tick - b.tick);
    let duration = 0;
    const notes = raw.slice(0, 30000).map((r) => {
      const t = toSec(r.tick);
      const d = Math.max(0.03, toSec(r.end) - t);
      duration = Math.max(duration, t + d);
      return { t, d, note: r.note, vel: r.vel, ch: r.ch };
    });
    return { notes, duration };
  };

  const midiCache = new Map();

  const getMidi = async (input) => {
    const key = Cast.toString(input).trim();
    if (!key) return null;
    if (midiCache.has(key)) return midiCache.get(key);
    let midi = null;
    try {
      midi = parseMidi(await readBytes(key));
    } catch (e) {
      console.warn('[App Sound] MIDI inválido:', e && e.message);
    }
    if (midi) {
      if (midiCache.size >= 6) midiCache.delete(midiCache.keys().next().value);
      midiCache.set(key, midi);
    }
    return midi;
  };

  let noiseBuf = null;

  const getNoise = (ctx) => {
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  };

  const HATS = [42, 44, 46, 49, 51, 52, 53, 55, 57, 59];

  const scheduleDrum = (ctx, out, player, note, t0, peak) => {
    const g = ctx.createGain();
    g.connect(out);
    let src;
    let dur;
    if (note === 35 || note === 36) {
      dur = 0.16;
      src = ctx.createOscillator();
      src.type = 'sine';
      src.frequency.setValueAtTime(140, t0);
      src.frequency.exponentialRampToValueAtTime(40, t0 + dur);
    } else {
      dur = HATS.includes(note) ? 0.05 : 0.14;
      src = ctx.createBufferSource();
      src.buffer = getNoise(ctx);
    }
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    player.nodes.add(src);
    src.onended = () => {
      player.nodes.delete(src);
      try {
        g.disconnect();
      } catch (e) {}
    };
  };

  const scheduleNote = (ctx, out, player, n, t0, dur, wave) => {
    const peak = (n.vel / 127) * 0.22;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const end = t0 + dur;
    o.type = wave;
    o.frequency.value = 440 * Math.pow(2, (n.note - 69) / 12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    g.gain.setValueAtTime(peak, Math.max(t0 + 0.008, end - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, end + 0.06);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(end + 0.08);
    player.nodes.add(o);
    o.onended = () => {
      player.nodes.delete(o);
      try {
        g.disconnect();
      } catch (e) {}
    };
  };

  const playMidi = (midi, wave, speed, volume) =>
    new Promise((resolve) => {
      let ctx = null;
      try {
        ctx = getAudio();
      } catch (e) {}
      if (!ctx || !midi.notes.length) {
        resolve();
        return;
      }
      const sp = clamp(speed, 10, 400) / 100;
      const master = ctx.createGain();
      master.gain.value = clamp(volume, 0, 100) / 100;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);

      const startAt = ctx.currentTime + 0.1;
      const wallStart = Date.now();
      const total = midi.duration / sp;
      let idx = 0;
      const player = { nodes: new Set(), timer: 0, done: false, stop: null };

      player.stop = () => {
        if (player.done) return;
        player.done = true;
        clearInterval(player.timer);
        players.delete(player);
        player.nodes.forEach((o) => {
          try {
            o.stop();
          } catch (e) {}
        });
        player.nodes.clear();
        setTimeout(() => {
          try {
            master.disconnect();
            comp.disconnect();
          } catch (e) {}
        }, 300);
        resolve();
      };

      const pump = () => {
        if (player.done) return;
        try {
          const now = ctx.currentTime;
          const horizon = now + 1.5;
          while (idx < midi.notes.length) {
            const n = midi.notes[idx];
            const t0 = startAt + n.t / sp;
            if (t0 > horizon) break;
            idx++;
            const dur = Math.max(0.04, n.d / sp);
            if (t0 + dur < now) continue; // atrasada demais, pula
            if (n.ch === 9) scheduleDrum(ctx, master, player, n.note, t0, (n.vel / 127) * 0.3);
            else scheduleNote(ctx, master, player, n, t0, dur, wave);
          }
          const elapsed = (Date.now() - wallStart) / 1000;
          if (elapsed > total + 3 || (idx >= midi.notes.length && now > startAt + total + 0.3)) {
            player.stop();
          }
        } catch (e) {
          player.stop();
        }
      };

      players.add(player);
      player.timer = setInterval(pump, 80);
      pump();
    });

  const pickMidiFile = () =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mid,.midi,audio/midi,audio/x-midi';
      input.style.display = 'none';
      document.body.appendChild(input);
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(value);
      };
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) {
          done('');
          return;
        }
        file
          .arrayBuffer()
          .then((buf) => done(bytesToBase64(new Uint8Array(buf))))
          .catch(() => done(''));
      };
      input.oncancel = () => done('');
      input.click();
    });

  const stopAll = () => {
    Array.from(players).forEach((p) => p.stop());
    activeNodes.forEach((o) => {
      try {
        o.stop();
      } catch (e) {}
    });
    activeNodes.clear();
  };

  try {
    Scratch.vm.runtime.on('PROJECT_STOP_ALL', stopAll);
  } catch (e) {}

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
            opcode: 'playMelodyNoWait',
            blockType: BT.COMMAND,
            text: 'play melody [NOTES] note length [MS] ms',
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
          }),

          label('MIDI'),
          B('sound', {
            opcode: 'playMidiWait',
            blockType: BT.COMMAND,
            text: 'play MIDI [MIDI] wave [WAVE] speed [SPEED]% volume [VOL]% and wait',
            arguments: {
              MIDI: str(''),
              WAVE: str('triangle', 'waveTypes'),
              SPEED: num(100),
              VOL: num(80)
            }
          }),
          B('sound', {
            opcode: 'playMidiNoWait',
            blockType: BT.COMMAND,
            text: 'play MIDI [MIDI] wave [WAVE] speed [SPEED]% volume [VOL]%',
            arguments: {
              MIDI: str(''),
              WAVE: str('triangle', 'waveTypes'),
              SPEED: num(100),
              VOL: num(80)
            }
          }),
          B('sound', { opcode: 'stopMidi', blockType: BT.COMMAND, text: 'stop MIDI' }),
          B('sound', {
            opcode: 'midiDuration',
            blockType: BT.REPORTER,
            text: 'duration of MIDI [MIDI] (s)',
            arguments: { MIDI: str('') }
          }),
          B('sound', {
            opcode: 'pickMidi',
            blockType: BT.REPORTER,
            text: 'choose MIDI file (as base64)'
          }),
          '---',
          B('sound', { opcode: 'stopAllSounds', blockType: BT.COMMAND, text: 'stop all App Sound sounds' })
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
      const total = melody(NOTES, Cast.toNumber(MS));
      await new Promise((r) => setTimeout(r, total));
    }

    playMelodyNoWait({ NOTES, MS }) {
      melody(NOTES, Cast.toNumber(MS));
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

    async playMidiWait({ MIDI, WAVE, SPEED, VOL }) {
      const midi = await getMidi(MIDI);
      if (!midi) return;
      await playMidi(midi, waveOf(WAVE, 'triangle'), Cast.toNumber(SPEED), Cast.toNumber(VOL));
    }

    playMidiNoWait({ MIDI, WAVE, SPEED, VOL }) {
      const wave = waveOf(WAVE, 'triangle');
      const speed = Cast.toNumber(SPEED);
      const vol = Cast.toNumber(VOL);
      getMidi(MIDI).then((midi) => {
        if (midi) playMidi(midi, wave, speed, vol);
      });
    }

    stopMidi() {
      Array.from(players).forEach((p) => p.stop());
    }

    async midiDuration({ MIDI }) {
      const midi = await getMidi(MIDI);
      return midi ? Math.round(midi.duration * 100) / 100 : 0;
    }

    pickMidi() {
      return pickMidiFile();
    }

    stopAllSounds() {
      stopAll();
    }
  }

  Scratch.extensions.register(new AppSound());
})(Scratch);