import { beforeEach, describe, expect, it } from 'vitest';
import { ambientGain } from '../src/audio/ambient';
import { AUDIO_STORAGE_KEY, AudioBus } from '../src/audio/engine';
import { CONFIG } from '../src/config';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe('ambient gain', () => {
  it('is master times ambient', () => {
    expect(ambientGain(0.8, 0.25)).toBeCloseTo(0.2);
    expect(ambientGain(1, 1)).toBe(1);
    expect(ambientGain(0, 0.5)).toBe(0);
    expect(ambientGain(0.5, 0)).toBe(0);
    expect(ambientGain(CONFIG.audio.defaultMaster, CONFIG.audio.defaultAmbient)).toBeCloseTo(0.2);
  });

  it('is zero while muted and drops non-finite or out-of-range input', () => {
    expect(ambientGain(0.8, 0.25, true)).toBe(0);
    expect(ambientGain(Number.NaN, 0.5)).toBe(0);
    expect(ambientGain(0.5, Number.POSITIVE_INFINITY)).toBe(0);
    expect(ambientGain(2, -1)).toBe(0);
    expect(ambientGain(2, 0.5)).toBeCloseTo(0.5);
    expect(ambientGain(-0.2, 0.4, false)).toBe(0);
  });
});

describe('mute all', () => {
  it('silences every channel and restores the same checkboxes and sliders', () => {
    const bus = new AudioBus();
    bus.setMusic(true);
    bus.setSfx(false);
    bus.setVolume('master', 0.8);
    bus.setVolume('music', 0.4);
    bus.setVolume('sfx', 0.6);
    bus.setVolume('ambient', 0.25);

    bus.setMuted(true);
    expect(bus.muted).toBe(true);
    expect(bus.musicOn).toBe(true);
    expect(bus.sfxOn).toBe(false);
    expect(bus.master).toBe(0.8);
    expect(bus.music).toBe(0.4);
    expect(bus.sfx).toBe(0.6);
    expect(bus.ambient).toBe(0.25);
    expect(bus.ambientLevel()).toBe(0);

    bus.setVolume('ambient', 0.9);
    bus.setVolume('master', 0.3);
    expect(bus.muted).toBe(true);
    expect(bus.ambientLevel()).toBe(0);

    bus.toggleMuted();
    expect(bus.muted).toBe(false);
    expect(bus.musicOn).toBe(true);
    expect(bus.sfxOn).toBe(false);
    expect(bus.master).toBe(0.3);
    expect(bus.music).toBe(0.4);
    expect(bus.sfx).toBe(0.6);
    expect(bus.ambient).toBe(0.9);
    expect(bus.ambientLevel()).toBeCloseTo(0.27);
  });

  it('clamps slider values and keeps mute from zeroing them', () => {
    const bus = new AudioBus();
    bus.setVolume('ambient', 4);
    bus.setVolume('master', Number.NaN);
    bus.setMuted(true);
    expect(bus.ambient).toBe(1);
    expect(bus.master).toBe(0);
    expect(bus.ambientLevel()).toBe(0);
    bus.setMuted(false);
    expect(bus.ambient).toBe(1);
    expect(bus.master).toBe(0);
    expect(bus.ambientLevel()).toBe(0);
  });
});

describe('audio preference persistence', () => {
  it('saves mute and the channel settings, then reloads them', () => {
    const first = new AudioBus();
    first.setMusic(false);
    first.setSfx(true);
    first.setVolume('master', 0.55);
    first.setVolume('music', 0.2);
    first.setVolume('sfx', 0.4);
    first.setVolume('ambient', 0.15);
    first.setTrack('exploration');
    first.setMode('shuffle');
    first.setMuted(true);

    const second = new AudioBus();
    expect(second.muted).toBe(true);
    expect(second.musicOn).toBe(false);
    expect(second.sfxOn).toBe(true);
    expect(second.master).toBe(0.55);
    expect(second.music).toBe(0.2);
    expect(second.sfx).toBe(0.4);
    expect(second.ambient).toBe(0.15);
    expect(second.track).toBe('exploration');
    expect(second.mode).toBe('shuffle');
    expect(second.ambientLevel()).toBe(0);

    second.setMuted(false);
    expect(second.musicOn).toBe(false);
    expect(second.ambientLevel()).toBeCloseTo(0.55 * 0.15);

    const third = new AudioBus();
    expect(third.muted).toBe(false);
    expect(third.musicOn).toBe(false);
    expect(third.sfxOn).toBe(true);
    expect(third.master).toBe(0.55);
    expect(third.ambient).toBe(0.15);
    expect(third.ambientLevel()).toBeCloseTo(0.55 * 0.15);
  });

  it('reads a save from before Mute all as unmuted and ignores junk', () => {
    localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({
        musicOn: false,
        sfxOn: true,
        master: 0.5,
        music: 0.5,
        sfx: 0.5,
        ambient: 0.5,
        track: 'airy',
        mode: 'shuffle',
      }),
    );
    const legacy = new AudioBus();
    expect(legacy.muted).toBe(false);
    expect(legacy.musicOn).toBe(false);
    expect(legacy.track).toBe('airy');
    expect(legacy.mode).toBe('shuffle');
    expect(legacy.ambientLevel()).toBeCloseTo(0.25);

    localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ track: 'meridian-dust', mode: 'loop' }),
    );
    const procedural = new AudioBus();
    expect(procedural.track).toBe('exploration');

    localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ track: 'nope', mode: 'nope', master: 'loud', muted: 'yes' }),
    );
    const junk = new AudioBus();
    expect(junk.muted).toBe(false);
    expect(junk.track).toBe('exploration');
    expect(junk.mode).toBe('loop');
    expect(junk.master).toBe(CONFIG.audio.defaultMaster);
    expect(junk.ambientLevel()).toBeCloseTo(CONFIG.audio.defaultMaster * CONFIG.audio.defaultAmbient);
  });
});
