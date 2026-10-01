import { CONFIG } from '../config';

export const TRACKS = [
  { id: 'meridian-dust', name: 'Meridian Dust' },
  { id: 'glass-orchard', name: 'Glass Orchard' },
  { id: 'protocol-red', name: 'Protocol Red' },
  { id: 'last-distress', name: 'Last Distress' },
  { id: 'quiet-revision', name: 'Quiet Revision' },
] as const;

type TrackId = (typeof TRACKS)[number]['id'];

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

const STORAGE_KEY = 'proxima-audio-prefs';

export class AudioBus {
  musicOn = true;
  sfxOn = true;
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

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch {
      /* prefs are optional */
    }
  }

  persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        musicOn: this.musicOn,
        sfxOn: this.sfxOn,
        master: this.master,
        music: this.music,
        sfx: this.sfx,
        ambient: this.ambient,
        track: this.track,
        mode: this.mode,
      }),
    );
  }

  unlock() {
    const ctx = this.context();
    if (ctx.state === 'suspended') void ctx.resume();
    this.started = true;
    if (this.musicOn && !this.playing) this.startMusic();
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private level(kind: 'music' | 'sfx') {
    const channel = kind === 'music' ? this.music : this.sfx;
    return this.master * channel;
  }

  startMusic() {
    if (!this.started || !this.musicOn) return;
    this.stopMusic();
    this.playing = true;
    this.step = 0;
    const ctx = this.context();
    const schedule = () => {
      if (!this.playing || !this.musicOn) return;
      const song = PATTERNS[this.track];
      const beat = song.tempo / 1000;
      for (const note of song.notes) {
        if (note.step === this.step % 16) this.tone(note.midi, note.dur * beat, note.gain * this.level('music'), note.wave);
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
    window.clearInterval(this.timer);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) this.stopMusic();
    else this.startMusic();
    this.persist();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    this.persist();
  }

  setTrack(id: TrackId) {
    this.track = id;
    this.persist();
    if (this.playing) this.startMusic();
  }

  setMode(mode: 'loop' | 'shuffle') {
    this.mode = mode;
    this.persist();
  }

  play(kind: 'click' | 'move' | 'found' | 'terraform' | 'terraformDone' | 'band' | 'attack' | 'turn' | 'error' | 'save' | 'open') {
    if (!this.sfxOn || !this.started) return;
    const vol = this.level('sfx');
    if (kind === 'click') this.tone(660, 0.05, 0.05 * vol, 'square');
    if (kind === 'move') this.tone(220, 0.08, 0.04 * vol, 'triangle');
    if (kind === 'found') {
      this.tone(392, 0.18, 0.06 * vol, 'triangle');
      this.tone(523, 0.22, 0.05 * vol, 'sine');
    }
    if (kind === 'terraform') this.earth(vol);
    if (kind === 'terraformDone') {
      this.tone(494, 0.2, 0.05 * vol, 'sine');
      this.tone(740, 0.28, 0.04 * vol, 'triangle');
    }
    if (kind === 'band') this.bandDamage(vol);
    if (kind === 'attack') this.noise(0.12, 900, vol * 0.2);
    if (kind === 'turn') this.tone(180, 0.12, 0.05 * vol, 'sine');
    if (kind === 'error') this.tone(140, 0.14, 0.06 * vol, 'sawtooth');
    if (kind === 'save') this.tone(520, 0.1, 0.04 * vol, 'sine');
    if (kind === 'open') this.tone(480, 0.06, 0.03 * vol, 'triangle');
  }

  /** A low rising scrape, like soil and metal working a tile. */
  private earth(vol: number) {
    const ctx = this.context();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.35);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08 * vol, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    this.tone(196, 0.3, 0.03 * vol, 'triangle');
  }

  /** Air failing: a dry hiss falling into a dull knock. */
  private bandDamage(vol: number) {
    this.noise(0.22, 1800, vol * 0.18, true);
    this.tone(70, 0.16, 0.08 * vol, 'sine');
  }

  private tone(midi: number, dur: number, gainValue: number, wave: OscillatorType) {
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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private noise(dur: number, freq: number, amount: number, fall = false) {
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
    gain.connect(ctx.destination);
    src.start();
  }
}
