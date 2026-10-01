/**
 * Procedural ambient bed: a low reactor hum under soft wind.
 * Generated with Web Audio at play time. No samples, so nothing here is licensed audio.
 *
 * The bed's output gain is `ambientGain` (master × ambient, or 0 while muted).
 * Oscillator and noise levels stay small so a full slider still sits under the music.
 */

export interface AmbientBed {
  setGain(value: number): void;
  stop(): void;
}

/** Loudness of the ambient bed: master × ambient, and silence while muted. */
export function ambientGain(master: number, ambient: number, muted = false): number {
  if (muted) return 0;
  return clamp01(master) * clamp01(ambient);
}

export function clamp01(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function createAmbientBed(ctx: AudioContext, level: number): AmbientBed {
  const output = ctx.createGain();
  const now = ctx.currentTime;
  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(Math.max(0, level), now + 0.45);
  output.connect(ctx.destination);

  const oscillators: OscillatorNode[] = [];
  const hum = (freq: number, amount: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = amount;
    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    oscillators.push(osc);
  };
  hum(46, 0.035);
  hum(46.35, 0.02);
  hum(92, 0.008);

  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  windGain.connect(output);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.015;
  lfo.connect(lfoDepth);
  lfoDepth.connect(windGain.gain);
  lfo.start(now);
  oscillators.push(lfo);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.6;
  const drift = ctx.createOscillator();
  drift.frequency.value = 0.05;
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = 70;
  drift.connect(driftDepth);
  driftDepth.connect(filter.frequency);
  drift.start(now);
  oscillators.push(drift);

  const source = ctx.createBufferSource();
  source.buffer = windBuffer(ctx);
  source.loop = true;
  source.connect(filter);
  filter.connect(windGain);
  source.start(now);

  return {
    setGain(value: number) {
      const at = ctx.currentTime;
      const next = Math.max(0, Number.isFinite(value) ? value : 0);
      output.gain.cancelScheduledValues(at);
      output.gain.setValueAtTime(output.gain.value, at);
      output.gain.linearRampToValueAtTime(next, at + 0.08);
    },
    stop() {
      const at = ctx.currentTime;
      try {
        output.gain.cancelScheduledValues(at);
        output.gain.setValueAtTime(output.gain.value, at);
        output.gain.linearRampToValueAtTime(0, at + 0.15);
      } catch {
        /* the context is already closed */
      }
      for (const osc of oscillators) {
        try {
          osc.stop(at + 0.2);
        } catch {
          /* already stopped */
        }
      }
      try {
        source.stop(at + 0.2);
      } catch {
        /* already stopped */
      }
      setTimeout(() => {
        try {
          output.disconnect();
        } catch {
          /* already disconnected */
        }
      }, 300);
    },
  };
}

/** Brown noise with a short crossfade so the loop point does not click. */
function windBuffer(ctx: AudioContext): AudioBuffer {
  const fade = Math.floor(ctx.sampleRate * 0.08);
  const length = Math.floor(ctx.sampleRate * 4);
  const raw = new Float32Array(length + fade);
  let hold = 0;
  for (let i = 0; i < raw.length; i++) {
    const white = Math.random() * 2 - 1;
    hold = hold * 0.985 + white * 0.015;
    raw[i] = hold;
  }
  const buffer = ctx.createBuffer(1, Math.max(1, length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = raw[i];
  for (let i = 0; i < fade && i < length; i++) {
    const mix = i / fade;
    data[i] = raw[i] * mix + raw[length + i] * (1 - mix);
  }
  let peak = 0.0001;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const scale = 0.85 / peak;
  for (let i = 0; i < length; i++) data[i] *= scale;
  return buffer;
}
