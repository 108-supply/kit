/* 108 interface sounds, shared by every 108 tool (Grainwash, Snip Snap, the next ones).
   Everything is synthesised with Web Audio, so there are no files to load and every play is a little different (pitch
   and timing wander by a few percent, like a real switch). The character: digital and precise, with a human touch from
   a soft tape saturation, a small room, and a dusting of film grain crackle on the bigger moments.

   import { sound, detents } from '@108-supply/kit/sound';
   The audio wakes by itself on the first pointerdown or key (browsers need a gesture). Then call the named sounds:
     tap()        any plain button: tiny, soft, just enough to feel it is a button
     tick(level)  a detent: carousel steps, slider steps, zoom steps; like the notches of a safe dial
     detents(el)  wires a range input: a tick per step, a firmer notch every 10, a soft bump at either end
     ratchet()    a run of detents spread over an eased move (the 90° turn)
     bump()       a soft thud at the end of a range
     press()      a final button (export, download): a heavier glass and metal key
     cut()        the cut: a light blade, not scissors
     peel(), whoosh(), settle(), rewind()  bigger moments: a sheet rolling up and flying off, landing, going back
   setMuted(), muted, onChange() drive a mute button; the choice is remembered per site.
   Haptics ride along where the device allows: navigator.vibrate on Android, the switch-control tick on iOS 18+. */

type Pan = number; // -1 left … 1 right

const STORE = '108.sound';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus!: GainNode; // everything goes here
  private room!: GainNode; // send to the small room
  private noiseBuf!: AudioBuffer;
  private dustBuf!: AudioBuffer;
  private lastTick = 0;
  private lastHaptic = 0;
  muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  constructor() {
    try { this.muted = localStorage.getItem(STORE) === 'off'; } catch { /* private mode */ }
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  }

  /** Create or wake the audio context. Browsers only allow it inside a user gesture. */
  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(STORE, m ? 'off' : 'on'); } catch { /* private mode */ }
    if (!m) this.unlock();
    this.listeners.forEach((f) => f(m));
  }
  onChange(f: (muted: boolean) => void) { this.listeners.add(f); }

  private build(ctx: AudioContext) {
    // Bus → soft tape saturation → gentle glue compressor → speakers; plus a send to a short, bright room
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
    sat.curve = curve;
    sat.oversample = '2x';
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    this.bus.connect(sat).connect(comp).connect(ctx.destination);

    this.room = ctx.createGain();
    this.room.gain.value = 0.16;
    const verb = ctx.createConvolver();
    const len = Math.round(ctx.sampleRate * 0.42);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'highpass';
    verbTone.frequency.value = 500;
    this.room.connect(verbTone).connect(verb).connect(this.bus);

    // White noise, and "dust": sparse clicks like specks on film
    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;
    this.dustBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const dd = this.dustBuf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.0016) {
        const amp = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
        const w = 2 + Math.floor(Math.random() * 6);
        for (let j = 0; j < w && i + j < n; j++) dd[i + j] += amp * (1 - j / w);
      }
    }
  }

  private ready() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  /* ---------- Building blocks ---------- */

  private out(ctx: AudioContext, pan: Pan, wet: number) {
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.bus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      p.connect(s).connect(this.room);
    }
    return g;
  }

  /** Filtered noise with a short attack and an exponential fall */
  private noise(t: number, o: { f: number; fEnd?: number; q?: number; type?: BiquadFilterType; dur: number; gain: number; attack?: number; pan?: Pan; wet?: number; buf?: AudioBuffer; rate?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = o.buf ?? this.noiseBuf;
    src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = this.out(ctx, o.pan ?? 0, o.wet ?? 0.4);
    const a = o.attack ?? 0.001;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 1.5, o.dur + 0.05);
  }

  /** An oscillator with a pitch glide and a fast-attack, exponential-decay envelope */
  private tone(t: number, o: { f: number; fEnd?: number; type?: OscillatorType; dur: number; gain: number; attack?: number; pan?: Pan; wet?: number; glide?: number }) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, t + (o.glide ?? o.dur));
    const g = this.out(ctx, o.pan ?? 0, o.wet ?? 0.4);
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  /** FM pair: a carrier swept by a modulator whose depth falls away; glassy, a little synthetic */
  private fm(t: number, o: { f: number; fEnd: number; ratio: number; index: number; dur: number; gain: number; pan?: Pan; wet?: number }) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const depth = ctx.createGain();
    car.frequency.setValueAtTime(o.f, t);
    car.frequency.exponentialRampToValueAtTime(o.fEnd, t + o.dur);
    mod.frequency.setValueAtTime(o.f * o.ratio, t);
    mod.frequency.exponentialRampToValueAtTime(o.fEnd * o.ratio, t + o.dur);
    depth.gain.setValueAtTime(o.f * o.index, t);
    depth.gain.exponentialRampToValueAtTime(1, t + o.dur);
    mod.connect(depth).connect(car.frequency);
    const g = this.out(ctx, o.pan ?? 0, o.wet ?? 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    car.connect(g);
    car.start(t); mod.start(t);
    car.stop(t + o.dur + 0.05); mod.stop(t + o.dur + 0.05);
  }

  /** Film grain: a few specks of dust */
  private dust(t: number, dur: number, gain: number, pan: Pan = 0) {
    this.noise(t, { buf: this.dustBuf, type: 'highpass', f: 1400, q: 0.5, dur, gain, attack: 0.02, pan, wet: 0.2, rate: 0.8 + Math.random() * 0.4 });
  }

  /* ---------- The sounds ---------- */

  /** Any plain button: a tiny, soft click */
  tap() {
    this.haptic('light');
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime, v = vary(0.05);
    this.noise(t, { f: 3400 * v, q: 1.6, dur: 0.022, gain: 0.16, wet: 0.25 });
    this.tone(t, { f: 1250 * v, fEnd: 820 * v, dur: 0.03, gain: 0.05, wet: 0.2 });
    this.tone(t, { f: 210 * v, dur: 0.035, gain: 0.06, wet: 0 });
  }

  /** One detent: a crisp, small metal notch with a little body under it */
  tick(level = 1, at = 0) {
    const ctx = this.ready();
    if (!at) this.haptic('tick');
    if (!ctx) return;
    const t = at || ctx.currentTime;
    if (!at && t - this.lastTick < 0.022) return; // fast swipes would buzz
    this.lastTick = t;
    const v = vary(0.04), l = Math.max(0.1, Math.min(1.4, level));
    this.noise(t, { f: 5600 * v, q: 7, dur: 0.016, gain: 0.32 * l, wet: 0.2 });
    this.tone(t, { f: 3300 * v, type: 'triangle', dur: 0.018, gain: 0.03 * l, wet: 0.15 });
    this.tone(t, { f: 165 * v, fEnd: 120, dur: 0.03, gain: 0.07 * l, wet: 0 });
  }

  /** Detents spread over an eased move: `progress` gives the eased position (0…1) for a time fraction (0…1) */
  ratchet(duration: number, steps: number, inverse: (p: number) => number) {
    for (let i = 1; i <= steps; i++) {
      const at = inverse(i / steps) * duration;
      const last = i === steps;
      setTimeout(() => this.haptic(last ? 'medium' : 'tick'), at * 1000);
    }
    const ctx = this.ready(); if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;
    for (let i = 1; i <= steps; i++) {
      const at = t0 + inverse(i / steps) * duration;
      const last = i === steps;
      this.tick(last ? 1.25 : 0.55 + 0.3 * Math.sin((Math.PI * i) / steps), at);
      if (last) this.tone(at, { f: 95, fEnd: 70, dur: 0.09, gain: 0.12, wet: 0 }); // it seats
    }
  }

  /** A soft thud: the end of a range */
  bump() {
    this.haptic('light');
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(t, { f: 110, fEnd: 70, dur: 0.1, gain: 0.14, wet: 0 });
    this.noise(t, { type: 'lowpass', f: 600, dur: 0.05, gain: 0.08, wet: 0.1 });
  }

  /** A final button: a heavier key of glass and metal, with a short bell and the key coming back up */
  press() {
    this.haptic('heavy');
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime, v = vary(0.02);
    this.noise(t, { f: 2900 * v, q: 3, dur: 0.014, gain: 0.34, wet: 0.3 });
    this.tone(t, { f: 170, fEnd: 105, dur: 0.11, gain: 0.2, wet: 0.1 });
    const base = 1320 * v;
    [[1, 0.06, 0.75], [2.76, 0.035, 0.5], [5.4, 0.018, 0.32], [8.93, 0.009, 0.2]].forEach(([r, g, d], i) =>
      this.tone(t + 0.004 * i, { f: base * r, dur: d, gain: g, wet: 0.7, pan: (i % 2 ? 0.15 : -0.15) }));
    this.noise(t + 0.11, { f: 4200 * v, q: 4, dur: 0.012, gain: 0.12, wet: 0.2 });
  }

  /** The cut: a light blade. A short charge while the cutter goes down, then a bright snap, a falling beam,
      a sub thump under it, a glass shimmer and a breath of film dust. `delay` = time until the cutter lands. */
  cut(delay = 0.17) {
    setTimeout(() => this.haptic('heavy'), delay * 1000);
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime, s = t + delay, v = vary(0.03);
    // charge
    this.tone(t, { f: 420 * v, fEnd: 1900 * v, dur: delay + 0.02, gain: 0.035, attack: delay * 0.9, wet: 0.3 });
    this.noise(t, { f: 1500, fEnd: 6500, q: 2, dur: delay + 0.02, gain: 0.06, attack: delay * 0.9, wet: 0.3 });
    // snap
    this.noise(s, { f: 2600 * v, q: 0.9, dur: 0.035, gain: 0.5, wet: 0.4 });
    this.noise(s, { type: 'highpass', f: 7000, dur: 0.06, gain: 0.12, wet: 0.5 });
    // beam
    this.fm(s, { f: 2100 * v, fEnd: 140, ratio: 1.99, index: 1.6, dur: 0.24, gain: 0.11, wet: 0.5 });
    // thump
    this.tone(s, { f: 82, fEnd: 42, dur: 0.28, gain: 0.42, wet: 0 });
    // shimmer
    [2637, 3951 * 1.004, 5274 * 0.997].forEach((f, i) => this.tone(s + 0.01 + i * 0.012, { f: f * v, dur: 0.55 - i * 0.1, gain: 0.022, wet: 0.9, pan: (i - 1) * 0.4 }));
    this.dust(s + 0.03, 0.5, 0.18);
  }

  /** The sheet rolls up: paper turning over, with fibres crackling. `pan` follows where it is grabbed. */
  peel(dur = 1.1, pan: Pan = 0) {
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, { f: 700, fEnd: 2400, q: 1.3, dur, gain: 0.11, attack: dur * 0.55, pan, wet: 0.35 });
    this.noise(t, { type: 'highpass', f: 5000, dur: dur * 0.9, gain: 0.03, attack: dur * 0.6, pan, wet: 0.3 });
    this.dust(t + 0.05, dur, 0.32, pan);
    this.dust(t + dur * 0.4, dur * 0.6, 0.22, pan * 0.6);
  }

  /** The sheet is thrown off: air, falling away to where it goes */
  whoosh(dur = 0.9, pan: Pan = 0) {
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(380, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(0, t);
    p.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, pan)), t + dur);
    const s = ctx.createGain();
    s.gain.value = 0.5;
    n.connect(f).connect(g).connect(p).connect(this.bus);
    p.connect(s).connect(this.room);
    n.start(t, Math.random(), dur + 0.05);
  }

  /** The piece comes to rest: a low, soft landing */
  settle() {
    this.haptic('light');
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(t, { f: 140, fEnd: 96, dur: 0.16, gain: 0.1, wet: 0.2 });
    this.tone(t, { f: 1760 * vary(0.02), dur: 0.35, gain: 0.014, wet: 0.9 });
  }

  /** Back to cutting: a short reversed breath */
  rewind() {
    this.haptic('light');
    const ctx = this.ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, { f: 900, fEnd: 3200, q: 1.2, dur: 0.32, gain: 0.07, attack: 0.28, wet: 0.5 });
    this.tone(t + 0.27, { f: 2400 * vary(0.03), dur: 0.05, gain: 0.03, wet: 0.4 });
  }

  /* ---------- Haptics ---------- */

  private switchEl: HTMLLabelElement | null = null;
  haptic(kind: 'tick' | 'light' | 'medium' | 'heavy') {
    if (this.muted || typeof navigator === 'undefined') return;
    const now = performance.now();
    if (now - this.lastHaptic < 28) return;
    this.lastHaptic = now;
    const nav = navigator as Navigator;
    if (typeof nav.vibrate === 'function') {
      nav.vibrate({ tick: 4, light: 6, medium: 12, heavy: 18 }[kind]);
      return;
    }
    // iOS has no vibrate, but toggling a native switch gives one crisp tick (Safari 18 and later)
    if (!/iP(hone|ad|od)|Macintosh/.test(nav.userAgent) || !('ontouchend' in document)) return;
    if (!this.switchEl) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.append(input);
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      document.body.append(label);
      this.switchEl = label;
    }
    this.switchEl.click();
  }
}

function vary(amount: number) { return 1 + (Math.random() * 2 - 1) * amount; }

export const sound = new SoundEngine();

/** Inverse of GSAP's power3.inOut: the time fraction at which the eased value reaches p */
export function power3InOutInverse(p: number) {
  return p < 0.5 ? Math.cbrt(p / 4) : 1 - Math.cbrt(2 * (1 - p)) / 2;
}

/** Safe-dial detents on a range input: one tick per step, a firmer notch on every `major` step, a soft bump when the
    thumb reaches either end. Fast drags that skip steps still give one tick per input event (and the engine thins out
    ticks closer than 22 ms, so a fling never buzzes). Returns a function that removes the listener. */
export function detents(input: HTMLInputElement, { major = 10 }: { major?: number } = {}) {
  let last = Number(input.value);
  const onInput = () => {
    const v = Number(input.value);
    if (v === last) return;
    const min = Number(input.min || 0), max = Number(input.max || 100);
    if ((v <= min || v >= max) && last > min && last < max) sound.bump();
    else if (major > 0 && Math.floor(v / major) !== Math.floor(last / major)) sound.tick(0.95);
    else sound.tick(0.45);
    last = v;
  };
  // Values set from code (presets) move the thumb without an input event: start counting from there
  const onFocus = () => { last = Number(input.value); };
  input.addEventListener('input', onInput);
  input.addEventListener('pointerdown', onFocus);
  input.addEventListener('focus', onFocus);
  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('pointerdown', onFocus);
    input.removeEventListener('focus', onFocus);
  };
}
