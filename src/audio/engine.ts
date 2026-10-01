import { CONFIG } from '../config';
import { ambientGain, clamp01, createAmbientBed, type AmbientBed } from './ambient';
import {
  isTrackId,
  MUSIC_FILES,
  musicUrl,
  MusicDirector,
  nextExplore,
  type MusicCommand,
  type MusicScene,
  type SwitchCommand,
  type TrackId,
} from './music';
import { MusicPlayer } from './player';
import { playGameSfx, type GameSfx } from './sfx';

export { TRACKS } from './music';
export type { MusicScene, TrackId };

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
  track: TrackId = 'exploration';
  mode: 'loop' | 'shuffle' = 'loop';
  private ctx: AudioContext | null = null;
  private started = false;
  private playing = false;
  private scene: MusicScene = 'menu';
  private readonly director = new MusicDirector();
  private player: MusicPlayer | null = null;
  private playGen = 0;
  private musicOut: GainNode | null = null;
  private musicLevel: GainNode | null = null;
  private sfxOut: GainNode | null = null;
  private bed: AmbientBed | null = null;
  private tensionUntil = 0;
  private resumeOffset = 0;

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

  /**
   * Menu, intro, or the game. The same scene does not restart a track that is already playing.
   * Nothing is fetched until audio has been unlocked.
   */
  setScene(scene: MusicScene) {
    const changed = scene !== this.scene;
    this.scene = scene;
    if (!changed) {
      this.ensureMusic();
      return;
    }
    const cmd = this.director.enter(scene);
    this.followPick();
    if (!this.started || !this.musicOn || this.muted) return;
    if (cmd === null) {
      this.ensureMusic();
      return;
    }
    if (cmd.type === 'stop') {
      this.stopMusic();
      return;
    }
    this.playing = true;
    this.applyBuses();
    void this.playCommand(cmd);
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private level(kind: 'music' | 'sfx') {
    const channel = kind === 'music' ? this.music : this.sfx;
    return this.master * channel;
  }

  private musicLoudness() {
    return this.level('music') * CONFIG.audio.musicTrim;
  }

  /**
   * Starts the bed when music is on, audio is unlocked, and Mute all is off.
   * Leaves a playing track alone so slider moves do not restart it.
   */
  ensureMusic() {
    if (!this.started) return;
    if (!this.musicOn || this.muted) {
      this.stopMusic();
      return;
    }
    this.applyBuses();
    if (this.playing) return;
    const current = this.director.current;
    const file = current ? MUSIC_FILES[current] : undefined;
    const cmd: MusicCommand | null = file
      ? {
          type: 'switch',
          to: current as string,
          offset: 0,
          duration: CONFIG.audio.trackCrossfadeSec,
          kind: 'switch',
          loop: file.loop,
        }
      : this.director.enter(this.scene);
    this.followPick();
    if (!cmd || cmd.type === 'stop') return;
    this.playing = true;
    void this.playCommand(cmd);
  }

  stopMusic() {
    this.playing = false;
    this.tensionUntil = 0;
    if (this.director.tension) this.director.release(this.resumeOffset);
    this.player?.stop();
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

  setVolume(key: 'master' | 'music' | 'sfx' | 'ambient', value: number) {
    this[key] = clamp01(value);
    this.bed?.setGain(this.ambientLevel());
    if ((key === 'master' || key === 'music') && this.musicLevel) {
      const now = this.musicLevel.context.currentTime;
      this.musicLevel.gain.cancelScheduledValues(now);
      this.musicLevel.gain.setValueAtTime(this.musicLoudness(), now);
    }
    this.persist();
  }

  setTrack(id: string) {
    if (!isTrackId(id)) return;
    this.track = id;
    this.persist();
    const cmd = this.director.pick(id);
    if (!cmd || cmd.type !== 'switch' || !this.playing || !this.started || !this.musicOn || this.muted) return;
    void this.playCommand(cmd);
  }

  setMode(mode: 'loop' | 'shuffle') {
    this.mode = mode;
    this.director.mode = mode;
    this.persist();
  }

  /**
   * Combat or a war declaration. Urgent takes the bed for a short hold, then
   * the exploration track fades back in. Ignored off the map and before unlock.
   */
  stirTension() {
    if (!this.started || this.scene !== 'game' || !this.musicOn || this.muted) return;
    const now = this.context().currentTime;
    this.tensionUntil = now + CONFIG.audio.tensionHoldSec;
    if (this.director.tension) return;
    this.resumeOffset = this.player?.position() ?? 0;
    const cmd = this.director.stir();
    if (!cmd || cmd.type !== 'switch') return;
    this.playing = true;
    this.applyBuses();
    void this.playCommand(cmd);
  }

  play(kind: 'click' | 'move' | 'found' | 'terraform' | 'terraformDone' | 'pulse' | 'attack' | 'turn' | 'error' | 'save' | 'open') {
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
    if (kind === 'pulse') this.pulseHit(vol, dest);
    if (kind === 'attack') this.noise(0.12, 900, vol * 0.2, false, dest);
    if (kind === 'turn') this.tone(180, 0.12, 0.05 * vol, 'sine', dest);
    if (kind === 'error') this.tone(140, 0.14, 0.06 * vol, 'sawtooth', dest);
    if (kind === 'save') this.tone(520, 0.1, 0.04 * vol, 'sine', dest);
    if (kind === 'open') this.tone(480, 0.06, 0.03 * vol, 'triangle', dest);
  }

  /**
   * Terraforming and harsh-ground travel damage.
   * Uses the same mute, unlock, and sfx loudness as play().
   */
  playCue(kind: GameSfx, delay = 0) {
    if (!this.sfxOn || !this.started || this.muted) return;
    playGameSfx(this.context(), kind, this.level('sfx'), delay, this.bus('sfx'));
  }

  /** Air failing: a dry hiss falling into a dull knock. */
  private pulseHit(vol: number, dest: AudioNode) {
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

  private async playCommand(cmd: SwitchCommand) {
    const file = MUSIC_FILES[cmd.to];
    if (!file) return;
    const gen = ++this.playGen;
    const player = this.ensurePlayer();
    const result = await player.play({
      id: cmd.to,
      url: musicUrl(file.file),
      offset: cmd.offset,
      fade: cmd.duration,
      lead: this.leadFor(cmd.to),
      loop: file.loop,
    });
    if (gen !== this.playGen) return;
    if (result === 'ok') {
      this.prefetchNext();
      return;
    }
    if (result === 'cancelled') return;
    console.warn(`Proxima music: ${cmd.to} did not load.`);
    const next = this.director.missing(cmd.to);
    if (next?.type === 'switch') {
      void this.playCommand(next);
      return;
    }
    if (next?.type === 'stop' || this.scene === 'intro') {
      this.playing = false;
      player.stop();
      return;
    }
    player.startFallback();
  }

  /** Exploration tracks overlap by a full track crossfade. Loops and Urgent use the short join. */
  private leadFor(id: string): number {
    const file = MUSIC_FILES[id];
    if (!file?.loop) return 0;
    if (this.scene === 'game' && isExploreTrack(id) && !this.director.tension) return CONFIG.audio.trackCrossfadeSec;
    return CONFIG.audio.loopCrossfadeSec;
  }

  private prefetchNext() {
    if (this.scene !== 'game' || !isExploreTrack(this.director.current)) return;
    const next = nextExplore(this.director.current, this.mode, () => 0);
    const file = MUSIC_FILES[next];
    if (file) this.ensurePlayer().warm(musicUrl(file.file));
  }

  private ensurePlayer(): MusicPlayer {
    if (!this.player) {
      this.player = new MusicPlayer(
        () => this.context(),
        () => this.musicDestination(),
        () => this.onFadeDone(),
        () => this.onBoundary(),
        () => this.onTickTension(),
      );
    }
    return this.player;
  }

  private onFadeDone() {
    const fade = this.director.fade;
    if (!fade) return;
    this.director.step(fade.duration - fade.elapsed);
  }

  private onBoundary() {
    const cmd = this.director.loopPoint(Math.random);
    if (!cmd || cmd.type === 'stop') {
      if (this.scene === 'intro') this.playing = false;
      return;
    }
    this.followPick();
    void this.playCommand(cmd);
  }

  private onTickTension() {
    if (!this.director.tension || !this.ctx || this.tensionUntil <= 0) return;
    if (this.ctx.currentTime < this.tensionUntil) return;
    const cmd = this.director.release(this.resumeOffset);
    this.tensionUntil = 0;
    if (!cmd || cmd.type === 'stop') return;
    this.followPick();
    void this.playCommand(cmd);
  }

  private followPick() {
    if (this.track === this.director.picked) return;
    this.track = this.director.picked;
    this.persist();
  }

  private musicDestination(): AudioNode {
    const gate = this.bus('music');
    if (!this.musicLevel) {
      const node = this.context().createGain();
      node.gain.value = this.musicLoudness();
      node.connect(gate);
      this.musicLevel = node;
    }
    return this.musicLevel;
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
    if (this.musicLevel) this.musicLevel.gain.value = this.musicLoudness();
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
    if (isTrackId(data.track)) {
      this.track = data.track;
      this.director.picked = data.track;
    }
    if (data.mode === 'loop' || data.mode === 'shuffle') {
      this.mode = data.mode;
      this.director.mode = data.mode;
    }
  }
}

function isExploreTrack(id: string | null): id is 'sector' | 'airy' | 'exploration' {
  return id === 'sector' || id === 'airy' || id === 'exploration';
}
