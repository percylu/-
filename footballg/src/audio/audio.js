// Fully procedural sound: no audio files are shipped.
export class Audio {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
    this.excite = 0;
    this.exciteTarget = 0;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // noise buffers
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.03;
        b1 = 0.96 * b1 + w * 0.1;
        b2 = 0.6 * b2 + w * 0.4;
        d[i] = (b0 * 2.2 + b1 * 0.9 + b2 * 0.25) * 0.9;
      }
      // crossfade the loop point
      const xf = 4000;
      for (let i = 0; i < xf; i++) {
        const k = i / xf;
        d[len - xf + i] = d[len - xf + i] * (1 - k) + d[i] * k;
      }
    }
    this.noise = buf;

    // crowd bed: two band-passed layers
    const mk = (freq, q, gain, rate) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(0, Math.random() * 3);
      return { bp, g, base: gain, freq };
    };
    this.bedLow = mk(420, 0.5, 0.5, 0.85);
    this.bedMid = mk(1100, 0.7, 0.22, 1.1);
    this.bedHigh = mk(2600, 0.9, 0.05, 1.3);
    this._lfoT = 0;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  setExcite(x) {
    this.exciteTarget = x;
  }

  update(dt) {
    if (!this.ctx) return;
    const k = this.exciteTarget > this.excite ? 6 : 0.7;
    this.excite += (this.exciteTarget - this.excite) * Math.min(1, dt * k);
    this._lfoT += dt;
    const sw = 1 + 0.18 * Math.sin(this._lfoT * 0.37) + 0.1 * Math.sin(this._lfoT * 1.13 + 1.7);
    const t = this.ctx.currentTime;
    const e = this.excite;
    this.bedLow.g.gain.setTargetAtTime(this.bedLow.base * sw * (1 + e * 1.6), t, 0.08);
    this.bedMid.g.gain.setTargetAtTime(this.bedMid.base * sw * (1 + e * 4.5), t, 0.08);
    this.bedHigh.g.gain.setTargetAtTime(this.bedHigh.base * (1 + e * 9), t, 0.08);
    this.bedMid.bp.frequency.setTargetAtTime(this.bedMid.freq * (1 + e * 0.5), t, 0.1);
  }

  _noise(dur, { type = 'lowpass', freq = 1000, q = 0.7, gain = 0.5, attack = 0.002, freqEnd = null, rate = 1 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 3, dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.3, freqEnd = null, attack = 0.002 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  whistle(dur = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.setValueAtTime(0.16, t + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = ctx.createOscillator();
    trem.frequency.value = 38;
    const tg = ctx.createGain();
    tg.gain.value = 0.07;
    trem.connect(tg);
    tg.connect(g.gain);
    for (const f of [2890, 3020]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    trem.start(t);
    trem.stop(t + dur + 0.05);
    g.connect(this.master);
    this._noise(dur, { type: 'bandpass', freq: 3000, q: 3, gain: 0.05 });
  }

  kick(power) {
    this._tone(150, 0.13, { gain: 0.5 + power * 0.4, freqEnd: 48 });
    this._noise(0.09, { freq: 1400 + power * 1600, gain: 0.35 + power * 0.35 });
  }

  bounce(s) {
    const g = Math.min(0.35, 0.05 + s * 0.02);
    this._tone(110, 0.09, { gain: g, freqEnd: 60 });
    this._noise(0.05, { freq: 700, gain: g * 0.6 });
  }

  post(s) {
    const g = Math.min(0.5, 0.15 + s * 0.02);
    for (const [f, d, k] of [[412, 0.7, 1], [1093, 0.5, 0.6], [1748, 0.4, 0.4], [2671, 0.25, 0.3]]) this._tone(f, d, { gain: g * k, type: 'triangle' });
    this._noise(0.05, { type: 'highpass', freq: 1800, gain: g });
    this._tone(140, 0.12, { gain: g, freqEnd: 70 });
  }

  net(s) {
    this._noise(0.35, { type: 'bandpass', freq: 2400, q: 0.8, gain: Math.min(0.5, 0.15 + s * 0.012), attack: 0.01, freqEnd: 900 });
  }

  glove(s) {
    const g = Math.min(0.5, 0.2 + s * 0.012);
    this._noise(0.07, { freq: 1800, gain: g });
    this._tone(180, 0.08, { gain: g * 0.7, freqEnd: 80 });
  }

  body(s) {
    this._tone(120, 0.1, { gain: Math.min(0.4, 0.1 + s * 0.015), freqEnd: 60 });
    this._noise(0.06, { freq: 900, gain: 0.2 });
  }

  board(s) {
    this._tone(210, 0.18, { gain: Math.min(0.4, 0.1 + s * 0.02), freqEnd: 120, type: 'triangle' });
    this._noise(0.08, { freq: 1200, gain: 0.25 });
  }

  roar() {
    if (!this.ctx) return;
    this.excite = Math.max(this.excite, 0.7);
    this.setExcite(1);
    this._noise(3.6, { type: 'bandpass', freq: 900, q: 0.6, gain: 0.55, attack: 0.25, freqEnd: 1500, rate: 1.2 });
    this._noise(3.0, { type: 'bandpass', freq: 2400, q: 0.8, gain: 0.16, attack: 0.3, rate: 1.4 });
  }

  ooh() {
    if (!this.ctx) return;
    this.excite = Math.max(this.excite, 0.45);
    this._noise(1.7, { type: 'bandpass', freq: 640, q: 1.6, gain: 0.5, attack: 0.12, freqEnd: 330, rate: 0.9 });
  }

  click() {
    this._tone(880, 0.05, { gain: 0.12, type: 'triangle' });
  }

  tick(p) {
    this._tone(300 + p * 500, 0.03, { gain: 0.04, type: 'square' });
  }
}
