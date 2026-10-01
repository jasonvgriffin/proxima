import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { playLoggedCues } from '../src/audio/listen';
import {
  crossfadeGains,
  fadeProgress,
  isCombatOrWar,
  MusicDirector,
  nextExplore,
  type SwitchCommand,
} from '../src/audio/music';

function finish(director: MusicDirector) {
  const fade = director.fade;
  if (!fade) return;
  expect(director.step(fade.duration)).toBe(true);
  expect(director.fade).toBeNull();
}

function asSwitch(command: ReturnType<MusicDirector['enter']>): SwitchCommand {
  expect(command?.type).toBe('switch');
  return command as SwitchCommand;
}

describe('track selection', () => {
  it('plays Exploration Theme on the menu, and Sector if that file cannot load', () => {
    const menu = new MusicDirector();
    const opening = asSwitch(menu.enter('menu'));
    expect(opening.to).toBe('exploration');
    expect(opening.loop).toBe(true);
    expect(menu.current).toBe('exploration');
    finish(menu);

    const fallback = new MusicDirector();
    fallback.failed.add('exploration');
    expect(asSwitch(fallback.enter('menu')).to).toBe('sector');
  });

  it('starts the in-game rotation on Exploration Theme, or on a pinned track', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    expect(director.enter('game')).toBeNull();
    expect(director.current).toBe('exploration');
    expect(director.picked).toBe('exploration');

    const fresh = new MusicDirector();
    expect(asSwitch(fresh.enter('game')).to).toBe('exploration');
    expect(fresh.picked).toBe('exploration');
    finish(fresh);

    const pinned = new MusicDirector();
    pinned.pick('airy');
    finish(pinned);
    expect(pinned.enter('game')).toBeNull();
    expect(pinned.current).toBe('airy');
  });

  it('rotates Exploration Theme, Sector, and Airy, and shuffle skips the one playing', () => {
    const director = new MusicDirector();
    director.enter('game');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('sector');
    expect(director.fade?.from).toBe('exploration');
    expect(director.fade?.kind).toBe('switch');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('airy');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('exploration');
    finish(director);

    director.mode = 'shuffle';
    expect(nextExplore('sector', 'shuffle', () => 0)).toBe('exploration');
    expect(nextExplore('sector', 'shuffle', () => 0.999)).toBe('airy');
    const shuffled = asSwitch(director.loopPoint(() => 0));
    expect(shuffled.to).not.toBe('exploration');
    expect(['sector', 'airy']).toContain(shuffled.to);
  });

  it('loops the menu theme in place instead of rotating into the map', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    const again = asSwitch(director.loopPoint());
    expect(again.kind).toBe('loop');
    expect(again.to).toBe('exploration');
    expect(director.current).toBe('exploration');
    expect(again.duration).toBe(CONFIG.audio.loopCrossfadeSec);
  });

  it('does not advance while a crossfade is still open', () => {
    const director = new MusicDirector();
    director.enter('game');
    expect(director.fade).not.toBeNull();
    expect(director.loopPoint()).toBeNull();
    expect(director.current).toBe('exploration');
  });
});

describe('crossfade state', () => {
  it('uses an equal-power curve and finishes on the incoming track', () => {
    expect(crossfadeGains(0)).toEqual({ outgoing: 1, incoming: 0 });
    expect(crossfadeGains(1)).toEqual({ outgoing: 0, incoming: 1 });
    const mid = crossfadeGains(0.5);
    expect(mid.outgoing).toBeCloseTo(Math.SQRT1_2);
    expect(mid.incoming).toBeCloseTo(Math.SQRT1_2);
    expect(mid.outgoing ** 2 + mid.incoming ** 2).toBeCloseTo(1);

    const director = new MusicDirector();
    director.enter('game');
    const fade = director.fade!;
    expect(fade.from).toBeNull();
    expect(fade.to).toBe('exploration');
    expect(fadeProgress(fade)).toBe(0);
    expect(director.step(fade.duration / 2)).toBe(false);
    expect(fadeProgress(director.fade!)).toBeCloseTo(0.5);
    expect(crossfadeGains(fadeProgress(director.fade!)).incoming).toBeCloseTo(Math.SQRT1_2);
    expect(director.step(fade.duration / 2)).toBe(true);
    expect(director.fade).toBeNull();
    expect(director.current).toBe('exploration');
  });

  it('keeps the same track id across a loop-point overlap', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    const loop = asSwitch(director.loopPoint());
    expect(loop.kind).toBe('loop');
    expect(director.current).toBe('exploration');
    expect(director.fade?.to).toBe('exploration');
    expect(director.fade?.from).toBe('exploration');
    finish(director);
    expect(director.current).toBe('exploration');
  });
});

describe('tension and intro', () => {
  it('raises Urgent over the bed, ignores a second sting, then fades back', () => {
    const director = new MusicDirector();
    director.enter('game');
    finish(director);
    director.loopPoint();
    finish(director);
    expect(director.current).toBe('sector');

    const sting = asSwitch(director.stir());
    expect(sting.to).toBe('urgent');
    expect(director.tension).toBe(true);
    expect(director.bed).toBe('sector');
    expect(director.stir()).toBeNull();
    finish(director);

    const back = asSwitch(director.release(22));
    expect(back.to).toBe('sector');
    expect(back.offset).toBe(22);
    expect(director.tension).toBe(false);
    expect(director.current).toBe('sector');
  });

  it('plays Outworld once per intro visit and skips it when the file fails', () => {
    const director = new MusicDirector();
    const intro = asSwitch(director.enter('intro'));
    expect(intro.to).toBe('outworld');
    expect(intro.loop).toBe(false);
    finish(director);
    expect(director.loopPoint()).toEqual({ type: 'stop' });
    expect(director.current).toBeNull();
    expect(director.enter('intro')).toEqual({ type: 'stop' });

    director.enter('menu');
    finish(director);
    expect(asSwitch(director.enter('intro')).to).toBe('outworld');

    const broken = new MusicDirector();
    expect(broken.missing('outworld')).toEqual({ type: 'stop' });
    expect(broken.enter('intro')).toEqual({ type: 'stop' });
  });

  it('notices combat and war in the log and leaves travel damage alone', () => {
    expect(isCombatOrWar('The Helm declares war on Ironclad.')).toBe(true);
    expect(isCombatOrWar('Verdantia breaks the peace with The Helm.')).toBe(true);
    expect(isCombatOrWar('Scout defeats Raider (62%).')).toBe(true);
    expect(isCombatOrWar('Scout is lost attacking Raider (40%).')).toBe(true);
    expect(isCombatOrWar('Cutter is lost doing it (12%).')).toBe(true);
    expect(isCombatOrWar('Ship bombards Haven (55%).')).toBe(true);
    expect(isCombatOrWar('The Helm captures Haven (70%).')).toBe(true);
    expect(isCombatOrWar('Scout takes 5 damage outside the twilight band.')).toBe(false);
    expect(isCombatOrWar('The Helm offers peace to Ironclad.')).toBe(false);

    const stirred: string[] = [];
    playLoggedCues(
      {
        play() {},
        playCue() {},
        stirTension() {
          stirred.push('tension');
        },
      },
      [{ text: 'older', factionId: 'helm' }],
      [
        { text: 'older', factionId: 'helm' },
        { text: 'The Helm declares war on Ironclad.', factionId: 'helm' },
        { text: 'Scout defeats Raider (62%).', factionId: 'ironclad' },
      ],
      'helm',
    );
    expect(stirred).toEqual(['tension']);
  });
});
