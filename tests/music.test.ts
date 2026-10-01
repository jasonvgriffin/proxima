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
  it('plays the menu theme, and Exploration Theme if Title cannot load', () => {
    const menu = new MusicDirector();
    const opening = asSwitch(menu.enter('menu'));
    expect(opening.to).toBe('title');
    expect(opening.loop).toBe(true);
    expect(menu.current).toBe('title');
    finish(menu);

    const fallback = new MusicDirector();
    fallback.failed.add('title');
    expect(asSwitch(fallback.enter('menu')).to).toBe('exploration');
  });

  it('starts the exploration playlist in order, from the pinned track when there is one', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    expect(asSwitch(director.enter('game')).to).toBe('sector');
    expect(director.picked).toBe('sector');
    finish(director);

    const pinned = new MusicDirector();
    pinned.pick('airy');
    finish(pinned);
    expect(pinned.enter('game')).toBeNull();
    expect(pinned.current).toBe('airy');
  });

  it('rotates Sector, Airy, and Exploration Theme, and shuffle skips the one playing', () => {
    const director = new MusicDirector();
    director.enter('game');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('airy');
    expect(director.fade?.from).toBe('sector');
    expect(director.fade?.kind).toBe('switch');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('exploration');
    finish(director);
    expect(asSwitch(director.loopPoint()).to).toBe('sector');
    finish(director);

    director.mode = 'shuffle';
    expect(nextExplore('sector', 'shuffle', () => 0)).toBe('airy');
    expect(nextExplore('sector', 'shuffle', () => 0.999)).toBe('exploration');
    const shuffled = asSwitch(director.loopPoint(() => 0));
    expect(shuffled.to).not.toBe('sector');
    expect(['airy', 'exploration']).toContain(shuffled.to);
  });

  it('loops the menu theme in place instead of rotating into the map', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    const again = asSwitch(director.loopPoint());
    expect(again.kind).toBe('loop');
    expect(again.to).toBe('title');
    expect(director.current).toBe('title');
    expect(again.duration).toBe(CONFIG.audio.loopCrossfadeSec);
  });

  it('does not advance while a crossfade is still open', () => {
    const director = new MusicDirector();
    director.enter('game');
    expect(director.fade).not.toBeNull();
    expect(director.loopPoint()).toBeNull();
    expect(director.current).toBe('sector');
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
    expect(fade.to).toBe('sector');
    expect(fadeProgress(fade)).toBe(0);
    expect(director.step(fade.duration / 2)).toBe(false);
    expect(fadeProgress(director.fade!)).toBeCloseTo(0.5);
    expect(crossfadeGains(fadeProgress(director.fade!)).incoming).toBeCloseTo(Math.SQRT1_2);
    expect(director.step(fade.duration / 2)).toBe(true);
    expect(director.fade).toBeNull();
    expect(director.current).toBe('sector');
  });

  it('keeps the same track id across a loop-point overlap', () => {
    const director = new MusicDirector();
    director.enter('menu');
    finish(director);
    const loop = asSwitch(director.loopPoint());
    expect(loop.kind).toBe('loop');
    expect(director.current).toBe('title');
    expect(director.fade?.to).toBe('title');
    expect(director.fade?.from).toBe('title');
    finish(director);
    expect(director.current).toBe('title');
  });
});

describe('tension and intro', () => {
  it('raises Urgent over the bed, ignores a second sting, then fades back', () => {
    const director = new MusicDirector();
    director.enter('game');
    finish(director);
    director.loopPoint();
    finish(director);
    expect(director.current).toBe('airy');

    const sting = asSwitch(director.stir());
    expect(sting.to).toBe('urgent');
    expect(director.tension).toBe(true);
    expect(director.bed).toBe('airy');
    expect(director.stir()).toBeNull();
    finish(director);

    const back = asSwitch(director.release(22));
    expect(back.to).toBe('airy');
    expect(back.offset).toBe(22);
    expect(director.tension).toBe(false);
    expect(director.current).toBe('airy');
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
