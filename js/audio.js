/* Lightweight Pazu-style Web Audio sound effects (zero external assets) */
(function (global) {
  'use strict';

  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this._boilInterval = null;
      this._pourNodes = null;
    }

    _ensureContext() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    setMuted(muted) {
      this.muted = !!muted;
      if (this.muted) {
        this.stopBoiling();
        this.stopPouring();
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      if (!this.muted) this.pop(580);
      return this.muted;
    }

    /* Cute squishy Pazu button pop */
    pop(freq = 520, duration = 0.08) {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.78, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + duration * 0.45);
      osc.frequency.exponentialRampToValueAtTime(freq, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    /* Soft tick for sliders */
    tick(pitch = 680) {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.036);
    }

    /* Single water bubble bloop */
    bubble(intensity = 0.5) {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const base = 240 + Math.random() * 260 + intensity * 180;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 2.1, now + 0.075);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06 + intensity * 0.05, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    startBoiling(getIntensity) {
      this.stopBoiling();
      if (this.muted) return;
      this._ensureContext();
      this._boilInterval = global.setInterval(() => {
        if (this.muted) return;
        const level = typeof getIntensity === 'function' ? getIntensity() : 0.5;
        if (Math.random() < 0.35 + level * 0.65) {
          this.bubble(level);
        }
      }, 130);
    }

    stopBoiling() {
      if (this._boilInterval) {
        global.clearInterval(this._boilInterval);
        this._boilInterval = null;
      }
    }

    /* Cheerful kettle ready whistle + chime */
    kettleReady() {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [587.33, 783.99, 1046.5]; // D5, G5, C6
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.095;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    }

    /* Filtered noise + rising pitch pour splash */
    startPouring() {
      this.stopPouring();
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.2;
      filter.frequency.setValueAtTime(480, now);
      filter.frequency.exponentialRampToValueAtTime(1150, now + 1.8);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      const glugInterval = global.setInterval(() => {
        if (!this.muted) this.bubble(0.75);
      }, 170);

      this._pourNodes = { noise, gain, glugInterval };
    }

    stopPouring() {
      if (!this._pourNodes) return;
      const { noise, gain, glugInterval } = this._pourNodes;
      global.clearInterval(glugInterval);
      try {
        if (this.ctx) {
          const now = this.ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(0.0001, now, 0.04);
          noise.stop(now + 0.16);
        } else {
          noise.stop();
        }
      } catch (_) {
        /* ignore already-stopped node */
      }
      this._pourNodes = null;
    }

    /* Thermos lid snap click */
    lidClick() {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.05);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    /* Mission star sparkle fanfare */
    fanfare() {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const melody = [523.25, 659.25, 783.99, 1046.5];
      melody.forEach((freq, i) => {
        const t = now + i * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    }
  }

  global.NewtonAudio = new SoundFX();
})(window);
