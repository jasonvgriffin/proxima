import { CONFIG } from '../config';
import { ambientGain, clamp01, createAmbientBed, type AmbientBed } from './ambient';
import { playGameSfx, type GameSfx } from './sfx';

export const TRACKS = [
  { id: 'meridian-dust', name: 'Meridian Dust' },
  { id: 'glass-orchard', name: 'Glass Orchard' },
  { id: 'protocol-red', name: 'Protocol Red' },
  { id: 'last-distress', name: 'Last Distress' },
  { id: 'quiet-revision', name: 'Quiet Revision' },
] as const;

type TrackId = (typeof TRACKS)[number]['id'];

export type VolumeKey = 'master' | 'music' | 'sfx' | 'ambient';

interface Note {
  midi: number;
  step: number;
  dur: number;
  gain: number;
  wave: OscillatorType;
}

const PATTERNS: Record<TrackId, { tempo: number; notes: Note[] }> = {
  'meridian-dust': pattern(72, [0, 3, 7, 10, 7, 3, 0, 5], 0.9, 'triangle'),
  'glass-orchard': pattern(64, [0, 2, 7, 12, 7, 14, 10, 7], 1.05, 'sine'),
  'protocol-red': pattern(92, [0, 0, 1, 0, 3, 1, 0, 6], 0.7, 'square'),
  'last-distress': pattern(60, [0, 5, 7, 12, 10, 7, 5, 3], 1.2, 'sawtooth'),
  'quiet-revision': pattern(70, [0, 4, 7, 11, 7, 4, 2, 7], 1.1, 'sine'),
};

function pattern(root: number, degrees: number[], spacing: number, wave: OscillatorType): { tempo: number; notes: Note[] } {
  const notes: Note[] = [];
  degrees.forEach((degree, i) => {
    notes.push({ midi: root + degree, step: i * 2, dur: 1.6, gain: 0.08, wave });
    notes.push({ midi: root - 12 + (degree % 7), step: i * 2, dur: 2, gain: 0.05, wave: 'sine' });
  });
  notes.push({ midi: root - 24, step: 0, dur: 16, gain: 0.04, wave: 'triangle' });
  return { tempo: 150 * spacing, notes };
}

export const AUDIO_STORAGE_KEY = 'proxima-audio-prefs';

interface StoredPrefs {
  musicOn?: unknown;
  sfxOn?: unknown;
  muted?: unknown;
  master?: unknown;
  music?: unknown;
  sfx?: unknown;
  ambient?: unknown;
  track?: unknown;
  mode?: unknown;
}

export class AudioBus {
  musicOn = true;
  sfxOn = true;
  /** Silences music, effects, and ambient without clearing the checkboxes or sliders. */
  muted = false;
  master: number = CONFIG.audio.defaultMaster;
  music: number = CONFIG.audio.defaultMusic;
  sfx: number = CONFIG.audio.defaultSfx;
  ambient: number = CONFIG.audio.defaultAmbient;
  track: TrackId = 'meridian-dust';
  mode: 'loop' | 'shuffle' = 'loop';
  private ctx: AudioContext | null = null;
  private timer = 0;
  private step = 0;
  private playing = false;
  private started = false;
  private musicOut: GainNode | null = null;
  private sfxOut: GainNode | null = null;
  private bed: AmbientBed | null = null;

  constructor() {
    this.restore();
  }

  /** Master × ambient, or 0 while Mute all is on. */
  ambientLevel(): number {
    return ambientGain(this.master, this.ambient, this.muted);
  }

  persist() {
    try {
      localStorage.setItem(
        AUDIO_STORAGE_KEY,
        JSON.stringify({
          musicOn: this.musicOn,
          sfxOn: this.sfxOn,
          muted: this.muted,
          master: this.master,
          music: this.music,
          sfx: this.sfx,
          ambient: this.ambient,
          track: this.track,
          mode: this.mode,
        }),
      );
    } catch {
      /* prefs are optional */
    }
  }

  unlock() {
    const ctx = this.context();
    if (ctx.state === 'suspended') void ctx.resume();
    this.started = true;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyBuses();
    this.ensureMusic();
    this.bed?.setGain(this.ambientLevel());
    this.persist();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private level(kind: 'music' | 'sfx') {
    const channel = kind === 'music' ? this.music : this.sfx;
    return this.master * channel;
  }

  /**
   * Starts the track when music is on, audio is unlocked, and Mute all is off.
   * Leaves a playing track alone so slider moves do not restart it.
   */
  ensureMusic() {
    if (!this.started) return;
    if (!this.musicOn || this.muted) {
      this.stopMusic();
      return;
    }
    if (!this.playing) this.startMusic();
  }

  startMusic() {
    if (!this.started || !this.musicOn || this.muted) return;
    this.stopMusic();
    this.playing = true;
    this.step = 0;
    this.setBusGain(this.musicOut, 1);
    this.context();
    const schedule = () => {
      if (!this.playing || !this.musicOn || this.muted) return;
      const song = PATTERNS[this.track];
      const beat = song.tempo / 1000;
      for (const note of song.notes) {
        if (note.step === this.step % 16) {
          this.tone(note.midi, note.dur * beat, note.gain * this.level('music'), note.wave, this.bus('music'));
        }
      }
      this.step += 1;
      if (this.step % 16 === 0 && this.step > 0 && this.mode === 'shuffle') {
        const next = TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
        this.track = next;
      }
    };
    this.timer = window.setInterval(schedule, PATTERNS[this.track].tempo);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    this.setBusGain(this.musicOut, 0);
  }

  /** The wind and reactor hum. App calls this only during a game. */
  startAmbient() {
    if (!this.started) return;
    const level = this.ambientLevel();
    if (!this.bed) this.bed = createAmbientBed(this.context(), level);
    else this.bed.setGain(level);
  }

  /** Stops the bed outright. Used on the menu, the recap, and every other non-game screen. */
  stopAmbient() {
    if (!this.bed) return;
    this.bed.stop();
    this.bed = null;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.applyBuses();
    this.ensureMusic();
    this.persist();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    this.applyBuses();
    this.persist();
  }

  setVolume(key: VolumeKey, value: number) {
    this[key] = clamp01(value);
    this.bed?.setGain(this.ambientLevel());
    this.persist();
  }

  setTrack(id: string) {
    if (!isTrackId(id)) return;
    this.track = id;
    this.persist();
    if (this.playing) this.startMusic();
  }

  setMode(mode: 'loop' | 'shuffle') {
    this.mode = mode;
    this.persist();
  }

  play(kind: 'click' | 'move' | 'found' | 'terraform' | 'terraformDone' | 'band' | 'attack' | 'turn' | 'error' | 'save' | 'open') {
    if (!this.sfxOn || !this.started || this.muted) return;
    const vol = this.level('sfx');
    const dest = this.bus('sfx');
    if (kind === 'click') this.tone(660, 0.05, 0.05 * vol, 'square', dest);
    if (kind === 'move') this.tone(220, 0.08, 0.04 * vol, 'triangle', dest);
    if (kind === 'found') {
      this.tone(392, 0.18, 0.06 * vol, 'triangle', dest);
      this.tone(523, 0.22, 0.05 * vol, 'sine', dest);
    }
    if (kind === 'terraform') playGameSfx(this.context(), 'terraform-start', vol, 0, dest);
    if (kind === 'terraformDone') playGameSfx(this.context(), 'terraform-complete', vol, 0, dest);
    if (kind === 'band') this.bandDamage(vol, dest);
    if (kind === 'attack') this.noise(0.12, 900, vol * 0.2, false, dest);
    if (kind === 'turn') this.tone(180, 0.12, 0.05 * vol, 'sine', dest);
    if (kind === 'error') this.tone(140, 0.14, 0.06 * vol, 'sawtooth', dest);
    if (kind === 'save') this.tone(520, 0.1, 0.04 * vol, 'sine', dest);
    if (kind === 'open') this.tone(480, 0.06, 0.03 * vol, 'triangle', dest);
  }

  /**
   * Terraforming and outside-band travel damage.
   * Uses the same mute, unlock, and sfx loudness as play().
   */
  playCue(kind: GameSfx, delay = 0) {
    if (!this.sfxOn || !this.started || this.muted) return;
    playGameSfx(this.context(), kind, this.level('sfx'), delay, this.bus('sfx'));
  }

  /** Air failing: a dry hiss falling into a dull knock. */
  private bandDamage(vol: number, dest: AudioNode) {
    this.noise(0.22, 1800, vol * 0.18, true, dest);
    this.tone(70, 0.16, 0.08 * vol, 'sine', dest);
  }

  private tone(midi: number, dur: number, gainValue: number, wave: OscillatorType, dest?: AudioNode) {
    const ctx = this.context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(dest ?? ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private noise(dur: number, freq: number, amount: number, fall = false, dest?: AudioNode) {
    const ctx = this.context();
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    if (fall) filter.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.value = amount;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest ?? ctx.destination);
    src.start();
  }

  private bus(kind: 'music' | 'sfx'): GainNode {
    const current = kind === 'music' ? this.musicOut : this.sfxOut;
    if (current) return current;
    const ctx = this.context();
    const node = ctx.createGain();
    const open = kind === 'music' ? this.musicOn && !this.muted : this.sfxOn && !this.muted;
    node.gain.value = open ? 1 : 0;
    node.connect(ctx.destination);
    if (kind === 'music') this.musicOut = node;
    else this.sfxOut = node;
    return node;
  }

  private applyBuses() {
    this.setBusGain(this.musicOut, this.musicOn && !this.muted ? 1 : 0);
    this.setBusGain(this.sfxOut, this.sfxOn && !this.muted ? 1 : 0);
  }

  private setBusGain(bus: GainNode | null, value: number) {
    if (!bus) return;
    const now = bus.context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(value, now);
  }

  private restore() {
    let data: StoredPrefs | null = null;
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPrefs;
      if (!parsed || typeof parsed !== 'object') return;
      data = parsed;
    } catch {
      return;
    }
    if (typeof data.musicOn === 'boolean') this.musicOn = data.musicOn;
    if (typeof data.sfxOn === 'boolean') this.sfxOn = data.sfxOn;
    if (typeof data.muted === 'boolean') this.muted = data.muted;
    if (typeof data.master === 'number') this.master = clamp01(data.master);
    if (typeof data.music === 'number') this.music = clamp01(data.music);
    if (typeof data.sfx === 'number') this.sfx = clamp01(data.sfx);
    if (typeof data.ambient === 'number') this.ambient = clamp01(data.ambient);
    if (isTrackId(data.track)) this.track = data.track;
    if (data.mode === 'loop' || data.mode === 'shuffle') this.mode = data.mode;
  }
}

function isTrackId(value: unknown): value is TrackId {
  return typeof value === 'string' && TRACKS.some((track) => track.id === value);
}
