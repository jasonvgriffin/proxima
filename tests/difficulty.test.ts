import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import {
  DIFFICULTIES,
  DIFFICULTY_TABLE,
  crisisTuning,
  difficultyProfile,
  economyRates,
  normalizeDifficulty,
  outsideBandDamage,
} from '../src/core/difficulty';
import { Game } from '../src/core/game';
import { peaceWindow } from '../src/core/rules';
import type { Difficulty, GameState } from '../src/core/types';

const ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'brutal'];

function rivalReport(difficulty: Difficulty) {
  const game = Game.newGame({ seed: 4, player: 'helm', difficulty });
  game.state.whoseTurn = 'ironclad';
  const settler = game.unitsOf('ironclad').find((unit) => unit.canFound)!;
  const tile = game.tile(settler.x, settler.y);
  tile.terrain = 'forest';
  tile.resource = 'ark-debris';
  tile.zone = 'twilight';
  tile.livable = true;
  expect(game.foundCity(settler.id).ok).toBe(true);
  const city = game.citiesOf('ironclad')[0];
  const report = game.cityReport(city.id);
  expect(report).toBeTruthy();
  return report!;
}

describe('difficulty table', () => {
  it('offers Easy, Normal, Hard, and Brutal as the only levels', () => {
    expect(DIFFICULTIES.map((profile) => profile.id)).toEqual(ORDER);
    expect(DIFFICULTIES.map((profile) => profile.label)).toEqual(['Easy', 'Normal', 'Hard', 'Brutal']);
  });

  it('raises AI production, research, and credits as the level rises', () => {
    const rates = ORDER.map((id) => economyRates(false, id));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i].production).toBeGreaterThan(rates[i - 1].production);
      expect(rates[i].research).toBeGreaterThan(rates[i - 1].research);
      expect(rates[i].credits).toBeGreaterThan(rates[i - 1].credits);
    }
    expect(economyRates(true, 'brutal')).toEqual({ production: 1, research: 1, credits: 1 });
    expect(economyRates(false, 'normal')).toEqual({ production: 1, research: 1, credits: 1 });
  });

  it('makes rivals attack sooner, travel harsher, and the reactor earlier and stronger', () => {
    for (let i = 1; i < ORDER.length; i++) {
      const prev = ORDER[i - 1];
      const next = ORDER[i];
      expect(peaceWindow('normal', next)).toBeLessThan(peaceWindow('normal', prev));
      expect(outsideBandDamage(next)).toBeGreaterThan(outsideBandDamage(prev));
      expect(difficultyProfile(next).crisisStartRound).toBeLessThan(difficultyProfile(prev).crisisStartRound);
      expect(difficultyProfile(next).crisisStrength).toBeGreaterThan(difficultyProfile(prev).crisisStrength);
    }
    expect(outsideBandDamage('normal')).toBe(CONFIG.outsideBand.damagePerTurn);
    expect(difficultyProfile('normal').crisisStartRound).toBe(CONFIG.crisis.startRound);
    const early = difficultyProfile('brutal').crisisStartRound + 4;
    expect(crisisTuning(early, 'brutal').level).toBeGreaterThan(0);
    expect(crisisTuning(early, 'brutal').damage).toBeGreaterThan(crisisTuning(early, 'easy').damage);
    expect(crisisTuning(early, 'easy').level).toBe(0);
  });

  it('changes starting stockpiles and the yields of a rival city', () => {
    const games = ORDER.map((difficulty) => Game.newGame({ seed: 4, player: 'helm', difficulty }));
    for (let i = 1; i < games.length; i++) {
      expect(games[i].state.factions.helm.credits).toBeLessThan(games[i - 1].state.factions.helm.credits);
      expect(games[i].state.factions.ironclad.credits).toBeGreaterThan(games[i - 1].state.factions.ironclad.credits);
    }
    expect(games[1].state.factions.helm.credits).toBe(CONFIG.starting.credits);

    const reports = ORDER.map((difficulty) => rivalReport(difficulty));
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i].yields.minerals).toBeGreaterThan(reports[i - 1].yields.minerals);
      expect(reports[i].yields.research).toBeGreaterThan(reports[i - 1].yields.research);
      expect(reports[i].credits).toBeGreaterThan(reports[i - 1].credits);
    }
  });

  it('deals more outside-band damage on higher difficulties', () => {
    const losses = ORDER.map((difficulty) => {
      const game = Game.newGame({ seed: 8, player: 'helm', difficulty });
      const scout = game.unitsOf('helm').find((unit) => unit.role === 'scout')!;
      scout.x = 0;
      const tile = game.tile(0, scout.y);
      tile.livable = false;
      tile.zone = 'day';
      tile.terrain = 'scorched';
      const before = scout.hp;
      game.endTurn();
      const after = game.unitById(scout.id);
      expect(after).toBeTruthy();
      return before - after!.hp;
    });
    expect(losses).toEqual(ORDER.map((id) => outsideBandDamage(id)));
    for (let i = 1; i < losses.length; i++) expect(losses[i]).toBeGreaterThan(losses[i - 1]);
  });
});

describe('difficulty save and load', () => {
  it('keeps Brutal through serialize and fromState, and still applies its multipliers', () => {
    const game = Game.newGame({ seed: 9, player: 'helm', difficulty: 'brutal' });
    const saved = game.serialize();
    expect(saved.setup.difficulty).toBe('brutal');
    const loaded = Game.fromState(saved);
    expect(loaded.state.setup.difficulty).toBe('brutal');
    expect(loaded.state.factions.helm.credits).toBe(game.state.factions.helm.credits);
    expect(loaded.state.factions.ironclad.credits).toBe(game.state.factions.ironclad.credits);
    expect(economyRates(false, loaded.state.setup.difficulty)).toEqual({
      production: DIFFICULTY_TABLE.brutal.production,
      research: DIFFICULTY_TABLE.brutal.research,
      credits: DIFFICULTY_TABLE.brutal.credits,
    });
    expect(rivalReport(loaded.state.setup.difficulty).yields.minerals).toBe(rivalReport('brutal').yields.minerals);
  });

  it('defaults missing and older difficulty values to Normal', () => {
    const game = Game.newGame({ seed: 2, player: 'verdantia', difficulty: 'hard' });
    const legacy = game.serialize();
    (legacy.setup as { difficulty: string }).difficulty = 'very-aggressive';
    expect(Game.fromState(legacy).state.setup.difficulty).toBe('normal');

    const missing = game.serialize();
    delete (missing.setup as { difficulty?: Difficulty }).difficulty;
    expect(Game.fromState(missing).state.setup.difficulty).toBe('normal');

    const bare = game.serialize() as Partial<GameState>;
    delete bare.setup;
    expect(Game.fromState(bare as GameState).state.setup.difficulty).toBe('normal');

    expect(normalizeDifficulty(undefined)).toBe('normal');
    expect(normalizeDifficulty('hard')).toBe('hard');
    expect(normalizeDifficulty('very-aggressive')).toBe('normal');
  });
});
