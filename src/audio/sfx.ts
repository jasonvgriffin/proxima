/**
 * Original procedural sound effects for terraforming and for travel damage
 * on harsh ground. Generated with Web Audio at play time, so the
 * game stays offline and ships no sample files.
 *
 * Callers pass the sfx loudness from AudioBus (master × sfx, already muted
 * when sound effects are off). Peaks stay in the same range as the other stings.
 * An optional destination lets Mute all cut a sound that has already started.
 */

export type GameSfx = 'terraform-start' | 'terraform-progress' | 'terraform-complete' | 'travel-damage';

export function playGameSfx(ctx: AudioContext, kind: GameSfx, volume: number, delay = 0, dest?: AudioNode): void {
  if (!(volume > 0) || !Number.isFinite(volume) || !Number.isFinite(delay)) return;
  const t0 = ctx.currentTime + Math.max(0, delay);
  const out = dest ?? ctx.destination;
  if (kind === 'terraform-start') terraformStart(ctx, t0, volume, out);
  else if (kind === 'terraform-progress') terraformProgress(ctx, t0, volume, out);
  else if (kind === 'terraform-complete') terraformComplete(ctx, t0, volume, out);
  else travelDamage(ctx, t0, volume, out);
}

/** The rig bites the tile: a latch, then a rising scrape. */
function terraformStart(ctx: AudioContext, t0: number, volume: number, dest: AudioNode) {
  noise(ctx, t0, 0.045, 1600, 0.9, 0.05 * volume, dest, 900);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(280, t0);
  filter.frequency.exponentialRampToValueAtTime(1400, t0 + 0.34);
  filter.Q.value = 0.7;
  const gain = envelope(ctx, t0, 0.38, 0.07 * volume, dest);
  filter.connect(gain);
  osc(ctx, filter, 'sawtooth', 74, t0, 0.36, 168);
  osc(ctx, gain, 'triangle', 148, t0 + 0.04, 0.22);
}

/** One piston cycle while a terraformer keeps working. */
function terraformProgress(ctx: AudioContext, t0: number, volume: number, dest: AudioNode) {
  noise(ctx, t0, 0.05, 640, 1.4, 0.045 * volume, dest);
  noise(ctx, t0 + 0.09, 0.04, 880, 1.2, 0.035 * volume, dest);
  osc(ctx, envelope(ctx, t0 + 0.02, 0.07, 0.04 * volume, dest), 'triangle', 196, t0 + 0.02, 0.07);
}

/** A finished terraform job: a short open triad and a settled sub. */
function terraformComplete(ctx: AudioContext, t0: number, volume: number, dest: AudioNode) {
  const notes = [294, 370, 440];
  notes.forEach((freq, index) => {
    const start = t0 + index * 0.07;
    osc(ctx, envelope(ctx, start, 0.22, 0.045 * volume, dest), 'sine', freq, start, 0.22);
  });
  osc(ctx, envelope(ctx, t0, 0.42, 0.04 * volume, dest), 'sine', 73, t0, 0.4);
  noise(ctx, t0 + 0.05, 0.3, 500, 0.6, 0.02 * volume, dest, 220);
}

/** Air leaving the suit: a falling hiss and a dull knock. */
function travelDamage(ctx: AudioContext, t0: number, volume: number, dest: AudioNode) {
  noise(ctx, t0, 0.32, 2600, 0.85, 0.1 * volume, dest, 200);
  const knock = 54 + Math.random() * 10;
  osc(ctx, envelope(ctx, t0 + 0.04, 0.16, 0.07 * volume, dest), 'sine', knock, t0 + 0.04, 0.16);
  osc(ctx, envelope(ctx, t0, 0.06, 0.03 * volume, dest), 'triangle', 185, t0, 0.06);
}

function envelope(ctx: AudioContext, t0: number, dur: number, peak: number, dest: AudioNode): GainNode {
  const gain = ctx.createGain();
  const attack = Math.min(0.03, Math.max(0.012, dur * 0.22));
  const end = t0 + Math.max(dur, attack + 0.03);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(dest);
  return gain;
}

function osc(
  ctx: AudioContext,
  dest: AudioNode,
  wave: OscillatorType,
  freq: number,
  t0: number,
  dur: number,
  glideTo?: number,
) {
  const node = ctx.createOscillator();
  node.type = wave;
  node.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (glideTo && glideTo > 0) node.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  node.connect(dest);
  node.start(t0);
  node.stop(t0 + dur + 0.03);
}

function noise(
  ctx: AudioContext,
  t0: number,
  dur: number,
  freq: number,
  q: number,
  peak: number,
  dest: AudioNode,
  fallTo?: number,
) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(40, freq), t0);
  if (fallTo && fallTo > 0) filter.frequency.exponentialRampToValueAtTime(fallTo, t0 + dur);
  const gain = envelope(ctx, t0, dur, peak, dest);
  src.connect(filter);
  filter.connect(gain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}
