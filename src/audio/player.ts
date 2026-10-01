import { CONFIG } from '../config';
import { crossfadeGains } from './music';

export interface PlayRequest {
  id: string;
  url: string;
  offset: number;
  fade: number;
  /** Seconds before the file ends to start the next overlap. */
  lead: number;
  loop: boolean;
}

interface Voice {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  startedAt: number;
  offset: number;
  trackId: string | null;
  loop: boolean;
  /** How early the next overlap should begin. */
  lead: number;
}

/**
 * Two decoded voices into the music bus, with a short overlap at loop points
 * and between tracks. Files are fetched the first time they are asked for.
 * A quiet sine stands in only when every file for the cue failed to load.
 */
export class MusicPlayer {
  private voices: [Voice, Voice] | null = null;
  private active = 0;
  private fade: { from: number; to: number; start: number; dur: number } | null = null;
  private loopAt = Number.POSITIVE_INFINITY;
  private timer = 0;
  private generation = 0;
  private stopped = true;
  private cache = new Map<string, Promise<AudioBuffer | null>>();
  private fallback: OscillatorNode | null = null;
  private fallbackGain: GainNode | null = null;

  constructor(
    private readonly context: () => AudioContext,
    private readonly destination: () => AudioNode,
    private readonly onFadeDone: () => void,
    private readonly onBoundary: () => void,
    private readonly onTick: () => void,
  ) {}

  /** Decode ahead of the next playlist change. Safe to call more than once. */
  warm(url: string) {
    void this.load(url);
  }

  position(): number {
    const voice = this.voices?.[this.active];
    if (!voice?.buffer || !voice.source) return 0;
    const elapsed = this.context().currentTime - voice.startedAt;
    const pos = voice.offset + Math.max(0, elapsed);
    if (pos >= voice.buffer.duration) return 0;
    return pos;
  }

  async play(req: PlayRequest): Promise<'ok' | 'missing' | 'cancelled'> {
    this.loopAt = Number.POSITIVE_INFINITY;
    this.stopped = false;
    const gen = ++this.generation;
    this.stopFallback();
    this.ensureTimer();
    const buffer = await this.load(req.url);
    if (gen !== this.generation || this.stopped) return buffer ? 'cancelled' : 'missing';
    if (!buffer) return 'missing';
    this.ensureVoices();
    const voices = this.voices!;
    const reuseActive = !voices[this.active].source;
    const incoming = reuseActive ? this.active : 1 - this.active;
    const fade = Math.min(Math.max(0.05, req.fade), Math.max(0.05, buffer.duration / 3));
    this.startVoice(incoming, buffer, req);
    const now = this.context().currentTime;
    if (reuseActive) {
      this.fade = { from: -1, to: incoming, start: now, dur: fade };
    } else {
      this.fade = { from: this.active, to: incoming, start: now, dur: fade };
    }
    this.applyFade(now);
    return 'ok';
  }

  /** Used only when the music files themselves cannot be decoded. */
  startFallback() {
    if (this.fallback) return;
    const ctx = this.context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 49;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(this.destination());
    osc.start();
    this.fallback = osc;
    this.fallbackGain = gain;
  }

  stop() {
    this.stopped = true;
    this.generation += 1;
    this.fade = null;
    this.loopAt = Number.POSITIVE_INFINITY;
    if (this.voices) {
      this.stopVoice(0);
      this.stopVoice(1);
    }
    this.stopFallback();
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private tick() {
    if (this.stopped) return;
    const now = this.context().currentTime;
    if (this.fade && this.voices) {
      const p = this.applyFade(now);
      if (p >= 1) {
        if (this.fade.from >= 0 && this.fade.from !== this.fade.to) this.stopVoice(this.fade.from);
        this.active = this.fade.to;
        this.fade = null;
        this.armLoop();
        this.onFadeDone();
      }
    }
    if (!this.fade && !this.stopped && now >= this.loopAt) {
      this.loopAt = Number.POSITIVE_INFINITY;
      this.onBoundary();
    }
    if (!this.stopped) this.onTick();
  }

  private armLoop() {
    const voice = this.voices?.[this.active];
    if (!voice?.buffer || !voice.source) {
      this.loopAt = Number.POSITIVE_INFINITY;
      return;
    }
    const remain = Math.max(0.05, voice.buffer.duration - voice.offset);
    if (!voice.loop) {
      this.loopAt = voice.startedAt + remain;
      return;
    }
    this.loopAt = voice.startedAt + Math.max(0.05, remain - voice.lead);
  }

  private ensureVoices() {
    if (this.voices) return;
    const ctx = this.context();
    const dest = this.destination();
    const make = (): Voice => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(dest);
      return { gain, source: null, buffer: null, startedAt: 0, offset: 0, trackId: null, loop: true, lead: CONFIG.audio.loopCrossfadeSec };
    };
    this.voices = [make(), make()];
  }

  private startVoice(index: number, buffer: AudioBuffer, req: PlayRequest) {
    this.stopVoice(index);
    const voices = this.voices!;
    const ctx = this.context();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(voices[index].gain);
    let offset = Math.max(0, req.offset);
    if (offset > buffer.duration - 0.25) offset = 0;
    source.start(ctx.currentTime, offset);
    const voice = voices[index];
    voice.source = source;
    voice.buffer = buffer;
    voice.startedAt = ctx.currentTime;
    voice.offset = offset;
    voice.trackId = req.id;
    voice.loop = req.loop;
    voice.lead = req.loop ? Math.min(Math.max(0.05, req.lead), Math.max(0.05, buffer.duration / 3)) : 0;
  }

  private applyFade(now: number): number {
    if (!this.fade || !this.voices) return 0;
    const p = Math.min(1, (now - this.fade.start) / this.fade.dur);
    const gains = crossfadeGains(p);
    if (this.fade.from >= 0) this.voices[this.fade.from].gain.gain.value = gains.outgoing;
    this.voices[this.fade.to].gain.gain.value = gains.incoming;
    return p;
  }

  private stopVoice(index: number) {
    const voice = this.voices?.[index];
    if (!voice?.source) return;
    try {
      voice.source.stop();
    } catch {
      /* already ended */
    }
    voice.source.disconnect();
    voice.source = null;
    voice.gain.gain.value = 0;
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const cached = this.cache.get(url);
    if (cached) return cached;
    const job = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Music file ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => this.context().decodeAudioData(bytes))
      .catch(() => null);
    this.cache.set(url, job);
    return job;
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 50);
  }

  private stopFallback() {
    if (this.fallback) {
      try {
        this.fallback.stop();
      } catch {
        /* already stopped */
      }
      this.fallback.disconnect();
      this.fallback = null;
    }
    this.fallbackGain?.disconnect();
    this.fallbackGain = null;
  }
}
