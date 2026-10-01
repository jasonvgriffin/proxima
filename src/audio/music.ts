import { CONFIG } from '../config';

/**
 * Real music cues. The start menu, the pause menu, and Mute all still talk to
 * AudioBus; this module only decides which file is playing and how a crossfade
 * stands. Samples live in public/music and are fetched after the first gesture.
 */

export type MusicScene = 'menu' | 'game' | 'intro';
export type PlayMode = 'loop' | 'shuffle';

export const EXPLORE_IDS = ['exploration', 'sector', 'airy'] as const;
export type ExploreId = (typeof EXPLORE_IDS)[number];

/** Tracks the audio panel can pin. Urgent and Outworld are scene cues, not picks. */
export const TRACKS = [
  { id: 'exploration', name: 'Exploration Theme' },
  { id: 'sector', name: 'Sector' },
  { id: 'airy', name: 'Airy' },
] as const;

export type TrackId = (typeof TRACKS)[number]['id'];

export interface MusicFile {
  id: string;
  file: string;
  loop: boolean;
}

export const MUSIC_FILES: Record<string, MusicFile> = {
  sector: { id: 'sector', file: 'sector.ogg', loop: true },
  airy: { id: 'airy', file: 'airy.ogg', loop: true },
  exploration: { id: 'exploration', file: 'exploration.ogg', loop: true },
  urgent: { id: 'urgent', file: 'urgent.ogg', loop: true },
  outworld: { id: 'outworld', file: 'outworld.ogg', loop: false },
};

export function musicUrl(file: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}music/${file}`;
}

export function isTrackId(value: unknown): value is TrackId {
  return typeof value === 'string' && TRACKS.some((track) => track.id === value);
}

export function isExploreId(value: string | null): value is ExploreId {
  return value != null && (EXPLORE_IDS as readonly string[]).includes(value);
}

/** Combat and war lines from the game log. Rival yards count; travel damage does not. */
export function isCombatOrWar(text: string): boolean {
  return /declares war|breaks the peace|\bdefeats\b|is lost attacking|is lost doing it|\bbombards\b|\bcaptures\b/.test(text);
}

export interface FadeState {
  from: string | null;
  to: string;
  kind: 'loop' | 'switch';
  duration: number;
  elapsed: number;
}

export interface SwitchCommand {
  type: 'switch';
  to: string;
  offset: number;
  duration: number;
  kind: 'loop' | 'switch';
  loop: boolean;
}

export interface StopCommand {
  type: 'stop';
}

export type MusicCommand = SwitchCommand | StopCommand;

/** Equal-power curve: the two voices sum to a steady loudness. */
export function crossfadeGains(progress: number): { outgoing: number; incoming: number } {
  const p = clamp01(progress);
  if (p <= 0) return { outgoing: 1, incoming: 0 };
  if (p >= 1) return { outgoing: 0, incoming: 1 };
  return {
    outgoing: Math.cos((p * Math.PI) / 2),
    incoming: Math.sin((p * Math.PI) / 2),
  };
}

export function fadeProgress(fade: FadeState): number {
  if (fade.duration <= 0) return 1;
  return clamp01(fade.elapsed / fade.duration);
}

export function nextExplore(current: string, mode: PlayMode, random: () => number): ExploreId {
  if (mode === 'shuffle') {
    const pool = EXPLORE_IDS.filter((id) => id !== current);
    const roll = random();
    const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
    return pool[Math.floor(unit * pool.length)] ?? 'airy';
  }
  const index = EXPLORE_IDS.indexOf(current as ExploreId);
  if (index < 0) return EXPLORE_IDS[0];
  return EXPLORE_IDS[(index + 1) % EXPLORE_IDS.length];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Which bed to play, and the fade that gets there.
 * `current` updates when a switch starts so the rest of the game can read it.
 * `fade` stays until `step` finishes the overlap.
 */
export class MusicDirector {
  scene: MusicScene = 'menu';
  mode: PlayMode = 'loop';
  picked: TrackId = 'exploration';
  current: string | null = null;
  /** Exploration track to restore after Urgent. */
  bed: string | null = null;
  tension = false;
  fade: FadeState | null = null;
  /** Outworld plays once per visit to the intro. */
  introDone = false;
  readonly failed = new Set<string>();

  enter(scene: MusicScene): MusicCommand | null {
    const previous = this.scene;
    this.scene = scene;
    if (scene !== 'game') this.tension = false;
    if (scene === 'intro' && previous !== 'intro') this.introDone = false;
    if (scene === 'intro' && this.introDone) return { type: 'stop' };
    const to = this.targetForScene();
    if (scene === 'game' && to && isTrackId(to)) this.picked = to;
    if (!to) return { type: 'stop' };
    if (to === this.current) return null;
    return this.begin(to, 0, CONFIG.audio.trackCrossfadeSec, 'switch');
  }

  /** The track menu. Plays that file now, in whatever scene is up. */
  pick(id: string): MusicCommand | null {
    if (!isTrackId(id)) return null;
    this.picked = id;
    this.tension = false;
    if (id === this.current && !this.fade) return null;
    return this.begin(id, 0, CONFIG.audio.trackCrossfadeSec, 'switch');
  }

  /**
   * The file reached its end (or the overlap point of a loop).
   * Menu and a pinned track loop in place. The game rotates Exploration Theme,
   * Sector, and Airy. Loop order is that sequence; shuffle skips the one playing.
   */
  loopPoint(random: () => number = Math.random): MusicCommand | null {
    if (this.fade || !this.current) return this.current ? null : { type: 'stop' };
    if (this.scene === 'intro' && this.current === 'outworld') {
      this.introDone = true;
      this.current = null;
      this.fade = null;
      return { type: 'stop' };
    }
    if (this.tension) return this.begin(this.current, 0, CONFIG.audio.loopCrossfadeSec, 'loop');
    if (this.scene === 'game' && isExploreId(this.current)) {
      const next = this.availableExplore(nextExplore(this.current, this.mode, random));
      if (!next || next === this.current) return this.begin(this.current, 0, CONFIG.audio.loopCrossfadeSec, 'loop');
      if (isTrackId(next)) this.picked = next;
      return this.begin(next, 0, CONFIG.audio.trackCrossfadeSec, 'switch');
    }
    return this.begin(this.current, 0, CONFIG.audio.loopCrossfadeSec, 'loop');
  }

  /** Raise Urgent over the exploration bed. A second call leaves the sting running. */
  stir(): MusicCommand | null {
    if (this.scene !== 'game') return null;
    const urgent = this.firstAvailable('urgent');
    if (!urgent) return null;
    if (this.tension) return null;
    if (isExploreId(this.current)) this.bed = this.current;
    else if (!this.bed) this.bed = this.exploreStart();
    this.tension = true;
    return this.begin(urgent, 0, CONFIG.audio.trackCrossfadeSec, 'switch');
  }

  /** Fade Urgent out and return to the bed, from `offset` seconds in. */
  release(offset = 0): MusicCommand | null {
    if (!this.tension) return null;
    this.tension = false;
    const back = this.bed && !this.failed.has(this.bed) ? this.bed : this.exploreStart();
    if (!back) return { type: 'stop' };
    return this.begin(back, Math.max(0, offset), CONFIG.audio.trackCrossfadeSec, 'switch');
  }

  /** The file failed to decode. Try the scene's next choice. Outworld is skipped. */
  missing(id: string): MusicCommand | null {
    this.failed.add(id);
    if (this.current === id) this.current = null;
    if (this.bed === id) this.bed = null;
    this.fade = null;
    if (id === 'outworld') {
      this.introDone = true;
      return { type: 'stop' };
    }
    const alt = this.targetForScene() ?? this.firstAvailable('exploration', 'sector', 'airy');
    if (!alt || alt === id) return null;
    return this.begin(alt, 0, CONFIG.audio.trackCrossfadeSec, 'switch');
  }

  /** Advance the crossfade. Returns true when the overlap is finished. */
  step(dt: number): boolean {
    if (!this.fade) return false;
    const elapsed = this.fade.elapsed + Math.max(0, dt);
    if (elapsed < this.fade.duration) {
      this.fade = { ...this.fade, elapsed };
      return false;
    }
    this.fade = null;
    return true;
  }

  private targetForScene(): string | null {
    if (this.scene === 'intro') return this.firstAvailable('outworld');
    if (this.scene === 'menu') return this.firstAvailable('exploration', 'sector', 'airy');
    if (this.tension) return this.firstAvailable('urgent');
    return this.exploreStart();
  }

  private exploreStart(): string | null {
    if (isExploreId(this.picked) && !this.failed.has(this.picked)) return this.picked;
    return this.firstAvailable(...EXPLORE_IDS);
  }

  private availableExplore(preferred: string): string | null {
    if (!this.failed.has(preferred)) return preferred;
    return this.firstAvailable(...EXPLORE_IDS.filter((id) => id !== this.current));
  }

  private firstAvailable(...ids: string[]): string | null {
    for (const id of ids) {
      if (!this.failed.has(id) && MUSIC_FILES[id]) return id;
    }
    return null;
  }

  private begin(to: string, offset: number, duration: number, kind: 'loop' | 'switch'): SwitchCommand {
    const from = this.current;
    const span = Math.max(0.05, duration);
    this.fade = { from, to, kind, duration: span, elapsed: 0 };
    if (kind === 'switch') this.current = to;
    if (this.scene === 'game' && !this.tension && isExploreId(to)) this.bed = to;
    const file = MUSIC_FILES[to];
    return {
      type: 'switch',
      to,
      offset,
      duration: span,
      kind,
      loop: file ? file.loop : true,
    };
  }
}
