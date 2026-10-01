import { describe, expect, it } from 'vitest';
import {
  cuesForLines,
  freshLogLines,
  isReactorHarm,
  terraformProgressDelays,
  type LogLine,
} from '../src/audio/cues';
import { playLoggedCues, playTerraformProgress, snapshotTerraform } from '../src/audio/listen';
import { playGameSfx, type GameSfx } from '../src/audio/sfx';
import { CONFIG } from '../src/config';
import { Game } from '../src/core/game';
import type { GameSfx as CueKind } from '../src/audio/sfx';

function newGame(seed = 4) {
  return Game.newGame({
    seed,
    player: 'helm',
    difficulty: 'normal',
    alliedVictory: false,
    randomEvents: false,
    autosaveEnabled: false,
  });
}

function line(text: string, factionId?: string): LogLine {
  return { text, factionId };
}

describe('terraforming and travel-damage cues', () => {
  it('keeps new log lines when the cap drops older ones', () => {
    const kept = line('still here', 'helm');
    const dropped = line('scrolled off', 'helm');
    const added = line('Former finishes a farm. The tile joins the livable zone.', 'helm');
    expect(freshLogLines([dropped, kept], [kept, added])).toEqual([added]);
  });

  it('plays travel damage for the player and ignores rivals, the reactor, and sealed travel', () => {
    const hits = cuesForLines(
      [
        line('Scout takes 5 damage outside the twilight band.', 'helm'),
        line('Rover takes 5 damage outside the twilight band.', 'ironclad'),
        line('Walker is destroyed outside the livable zone.', 'helm'),
        line('Scout takes 4 from the reactor pulse.', 'helm'),
        line('Scout is lost to the Waking Reactor.', 'helm'),
        line('The Waking Reactor will fray the twilight band.'),
      ],
      'helm',
    );
    expect(hits.map((hit) => hit.kind)).toEqual(['travel-damage', 'travel-damage']);
    expect(hits[1].delay).toBeGreaterThan(hits[0].delay);
    expect(isReactorHarm('Scout takes 4 from the reactor pulse.')).toBe(true);
    expect(isReactorHarm('Scout is lost to the Waking Reactor.')).toBe(true);
  });

  it('caps a stack of travel hits so one turn cannot hiss forever', () => {
    const lines = [1, 2, 3, 4].map((n) => line(`Unit ${n} takes 5 damage outside the twilight band.`, 'helm'));
    expect(cuesForLines(lines, 'helm')).toHaveLength(3);
  });

  it('ticks progress only while the job is still going', () => {
    expect(terraformProgressDelays([{ id: 7, turnsLeft: 3 }], [{ id: 7, turnsLeft: 2 }])).toEqual([0]);
    expect(terraformProgressDelays([{ id: 7, turnsLeft: 1 }], [])).toEqual([]);
    expect(
      terraformProgressDelays(
        [
          { id: 1, turnsLeft: 4 },
          { id: 2, turnsLeft: 2 },
        ],
        [
          { id: 1, turnsLeft: 3 },
          { id: 2, turnsLeft: 1 },
        ],
      ).length,
    ).toBe(2);
  });

  it('routes completion and damage to cues, and reactor harm to the band sting', () => {
    const played: string[] = [];
    const audio = {
      play(kind: 'band') {
        played.push(kind);
      },
      playCue(kind: CueKind, delay = 0) {
        played.push(`${kind}:${delay}`);
      },
    };
    const before = [line('older', 'helm')];
    const after = [
      ...before,
      line('Former finishes a mine. The tile joins the livable zone.', 'helm'),
      line('Scout takes 5 damage outside the twilight band.', 'helm'),
      line('Scout takes 2 from the reactor pulse.', 'helm'),
      line('Cutter takes 5 damage outside the twilight band.', 'verdantia'),
    ];
    playLoggedCues(audio, before, after, 'helm');
    expect(played.some((entry) => entry.startsWith('terraform-complete'))).toBe(true);
    expect(played.some((entry) => entry.startsWith('travel-damage'))).toBe(true);
    expect(played).toContain('band');
    expect(played.some((entry) => entry.includes('verdantia'))).toBe(false);

    const progress: string[] = [];
    playTerraformProgress(
      {
        play() {},
        playCue(kind: CueKind) {
          progress.push(kind);
        },
      },
      [{ id: 3, turnsLeft: 2 }],
      [{ id: 3, turnsLeft: 1 }],
    );
    expect(progress).toEqual(['terraform-progress']);
  });

  it('follows a real terraforming job from a working week to the finished tile', () => {
    const game = newGame(5);
    const former = game.unitsOf('helm').find((unit) => unit.canTerraform)!;
    const started = game.startTerraform(former.id, 'farm');
    expect(started.ok).toBe(true);
    expect(former.terraform?.turnsLeft).toBeGreaterThan(1);

    const working = snapshotTerraform(game.state.units, 'helm');
    const logBefore = game.state.log.slice();
    game.endTurn();
    const progressed = terraformProgressDelays(working, snapshotTerraform(game.state.units, 'helm'));
    expect(progressed.length).toBe(1);
    expect(cuesForLines(freshLogLines(logBefore, game.state.log), 'helm').map((hit) => hit.kind)).not.toContain(
      'terraform-complete',
    );

    const still = game.unitById(former.id)!;
    still.terraform!.turnsLeft = 1;
    const finishing = game.state.log.slice();
    game.endTurn();
    const done = cuesForLines(freshLogLines(finishing, game.state.log), 'helm');
    expect(done.map((hit) => hit.kind)).toContain('terraform-complete');
    expect(terraformProgressDelays([{ id: still.id, turnsLeft: 1 }], snapshotTerraform(game.state.units, 'helm'))).toEqual([]);
    expect(game.tile(still.x, still.y).livable).toBe(true);
  });

  it('hears outside-band damage, destruction, and silence after Sealed Habitats', () => {
    const game = newGame(8);
    const units = game.unitsOf('helm');
    const scout = units.find((unit) => unit.role === 'scout')!;
    const former = units.find((unit) => unit.canTerraform)!;
    const scoutHp = scout.hp;
    const formerHp = former.hp;
    for (const unit of [scout, former]) {
      unit.x = 0;
      const tile = game.tile(0, unit.y);
      tile.livable = false;
      tile.zone = 'day';
      tile.terrain = 'scorched';
    }
    const before = game.state.log.slice();
    game.endTurn();
    const hits = cuesForLines(freshLogLines(before, game.state.log), 'helm');
    expect(hits.filter((hit) => hit.kind === 'travel-damage')).toHaveLength(2);
    expect(game.unitById(scout.id)?.hp).toBe(scoutHp - CONFIG.outsideBand.damagePerTurn);
    expect(game.unitById(former.id)?.hp).toBe(formerHp - CONFIG.outsideBand.damagePerTurn);

    const doomed = newGame(8);
    const victim = doomed.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    victim.x = 0;
    victim.hp = CONFIG.outsideBand.damagePerTurn;
    const harsh = doomed.tile(0, victim.y);
    harsh.livable = false;
    harsh.zone = 'day';
    harsh.terrain = 'scorched';
    const prior = doomed.state.log.slice();
    doomed.endTurn();
    const lost = cuesForLines(freshLogLines(prior, doomed.state.log), 'helm');
    expect(lost.filter((hit) => hit.kind === 'travel-damage')).toHaveLength(1);
    expect(doomed.unitById(victim.id)).toBeUndefined();

    const sealed = newGame(8);
    const safe = sealed.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    safe.x = 0;
    const home = sealed.tile(0, safe.y);
    home.livable = false;
    home.zone = 'day';
    home.terrain = 'scorched';
    sealed.state.factions.helm.techs.push('sealed-habitats');
    const quiet = sealed.state.log.slice();
    const hp = safe.hp;
    sealed.endTurn();
    expect(sealed.unitById(safe.id)?.hp).toBe(hp);
    expect(cuesForLines(freshLogLines(quiet, sealed.state.log), 'helm').map((hit) => hit.kind)).not.toContain(
      'travel-damage',
    );
  });
});

describe('procedural sfx', () => {
  it('schedules each cue and stays silent at zero volume', () => {
    const kinds: GameSfx[] = ['terraform-start', 'terraform-progress', 'terraform-complete', 'travel-damage'];
    for (const kind of kinds) {
      const ctx = fakeAudio();
      playGameSfx(ctx.context, kind, 0.5, 0.1);
      expect(ctx.osc).toBeGreaterThan(0);
      expect(ctx.started).toBeGreaterThan(0);
    }
    const silent = fakeAudio();
    playGameSfx(silent.context, 'travel-damage', 0);
    playGameSfx(silent.context, 'terraform-start', Number.NaN);
    expect(silent.osc).toBe(0);
  });
});

function fakeAudio() {
  const counts = { osc: 0, started: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() {
      return this;
    },
    exponentialRampToValueAtTime() {
      return this;
    },
    linearRampToValueAtTime() {
      return this;
    },
  });
  const node = () => {
    const self = {
      connect() {
        return self;
      },
      start() {
        counts.started += 1;
      },
      stop() {},
      frequency: param(),
      gain: param(),
      Q: param(),
      type: 'sine',
      buffer: null as unknown,
    };
    return self;
  };
  const context = {
    currentTime: 2,
    sampleRate: 8000,
    destination: {},
    createOscillator() {
      counts.osc += 1;
      return node();
    },
    createGain: () => node(),
    createBiquadFilter: () => node(),
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => node(),
  };
  return {
    get osc() {
      return counts.osc;
    },
    get started() {
      return counts.started;
    },
    context: context as unknown as AudioContext,
  };
}
