// Synthesized audio: two radio stations (pentatonic loops), engine hum,
// siren, gunshots, pickups, and mission stingers. Everything is guarded:
// with no AudioContext (no user gesture yet) every call is a no-op.
import { RADIOS } from './config.js';

export function makeAudio() {
  return {
    ctx: null, master: null, muted: false, station: 0,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    radioTimer: 0, radioStep: 0, radioNodes: [],
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { return false; }
      return true;
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    blip(freq, dur, type, vol, slideTo) {
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* ignore */ }
    },
    noise(dur, vol, freq) {
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = freq || 1200;
        const g = this.ctx.createGain();
        g.gain.value = vol || 0.3;
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t);
      } catch (e) { /* ignore */ }
    },
    shot(name) {
      if (name === 'FISTS') { this.blip(120, 0.08, 'square', 0.15, 60); return; }
      this.noise(0.12, name === 'SMG' ? 0.22 : 0.32, name === 'SMG' ? 2500 : 1600);
    },
    hit() { this.blip(300, 0.07, 'square', 0.12, 140); },
    hurt() { this.blip(160, 0.18, 'sawtooth', 0.18, 70); },
    reload() { this.blip(500, 0.06, 'square', 0.1); setTimeout(() => this.blip(700, 0.06, 'square', 0.1), 120); },
    pickup() { this.blip(660, 0.09, 'sine', 0.2); setTimeout(() => this.blip(880, 0.12, 'sine', 0.2), 90); },
    checkpoint() { this.blip(740, 0.1, 'triangle', 0.2); setTimeout(() => this.blip(1108, 0.14, 'triangle', 0.2), 100); },
    horn() { this.blip(340, 0.25, 'square', 0.14); this.blip(425, 0.25, 'square', 0.12); },
    missionStart() { [392, 494, 587].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 110)); },
    missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'triangle', 0.22), i * 120)); },
    missionFail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.14), i * 150)); },
    engine(speed, inCar) {
      if (!this.ctx) return;
      try {
        if (!inCar || speed < 0.5) {
          if (this.engineGain) this.engineGain.gain.value = 0;
          return;
        }
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 400;
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0;
          this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        this.engineOsc.frequency.value = 55 + speed * 3.2;
        this.engineGain.gain.value = 0.05 + Math.min(0.08, speed * 0.002);
      } catch (e) { /* ignore */ }
    },
    siren(on) {
      if (!this.ctx) return;
      try {
        if (!on) {
          if (this.sirenGain) this.sirenGain.gain.value = 0;
          return;
        }
        if (!this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenOsc.type = 'triangle';
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = 0;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 0.8;
          const lg = this.ctx.createGain();
          lg.gain.value = 180;
          lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
          this.sirenOsc.frequency.value = 750;
          this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
          this.sirenOsc.start(); lfo.start();
        }
        this.sirenGain.gain.value = 0.045;
      } catch (e) { /* ignore */ }
    },
    radioTick(dt) {
      if (!this.ctx || this.muted) return;
      const st = RADIOS[this.station];
      this.radioTimer -= dt;
      if (this.radioTimer > 0) return;
      this.radioTimer = st.tempo;
      const scale = st.scale;
      const deg = scale[this.radioStep % scale.length];
      const freq = st.base * Math.pow(2, deg / 12);
      this.blip(freq, st.tempo * 0.9, st.wave, 0.10);
      if (this.radioStep % 4 === 0) this.blip(st.base / 2, st.tempo * 1.6, 'sine', 0.07);
      this.radioStep++;
    },
    radioName() { return RADIOS[this.station].name + ' · ' + RADIOS[this.station].track; },
    nextStation() {
      this.station = (this.station + 1) % RADIOS.length;
      this.radioStep = 0; this.radioTimer = 0;
    },
  };
}
