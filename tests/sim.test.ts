import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { FACTION_IDS } from '../src/core/types';
import {
  invalidState,
  parseArgs,
  planGames,
  prepareAiOnly,
  recordsToCsv,
  runOneGame,
  summarize,
  wilsonInterval,
} from '../scripts/sim';

describe('headless sim', () => {
  it('parses the npm arguments and plans one game per seed', () => {
    const opts = parseArgs(['--games', '4', '--seed', '20', '--difficulty', 'all', '--events', 'off', '--jobs', '2']);
    expect(opts.games).toBe(4);
    expect(opts.seed).toBe(20);
    expect(opts.events).toBe(false);
    const plan = planGames(opts);
    expect(plan.map((row) => row.seed)).toEqual([20, 21, 22, 23]);
    expect(plan.map((row) => row.difficulty)).toEqual(['easy', 'normal', 'hard', 'brutal']);
    expect(new Set(plan.map((row) => row.playerSeat)).size).toBe(4);
  });

  it('plays every faction with the AI and equal stockpiles', () => {
    const game = Game.newGame({ seed: 7, player: 'helm', difficulty: 'brutal', randomEvents: false });
    expect(game.state.factions.helm.isHuman).toBe(true);
    expect(game.state.factions.helm.credits).toBeLessThan(game.state.factions.verdantia.credits);
    prepareAiOnly(game);
    for (const id of FACTION_IDS) expect(game.state.factions[id].isHuman).toBe(false);
    expect(game.state.factions.helm.credits).toBe(game.state.factions.ironclad.credits);
    expect(game.state.playerDefeated).toBe(false);
  });

  it('runs a short real game and reports a row', () => {
    const record = runOneGame({
      seed: 11,
      difficulty: 'normal',
      events: false,
      allied: false,
      playerSeat: 'genesis',
      maxTurns: 3,
      stallRounds: 40,
    });
    expect(record.status === 'unfinished' || record.status === 'finished').toBe(true);
    expect(record.map).toBe('60x40');
    expect(record.playerSeat).toBe('genesis');
    expect(record.issues).toEqual([]);
    for (const id of FACTION_IDS) {
      expect(record.factions[id].techs).toBeGreaterThan(0);
      expect(record.factions[id].score).toBeGreaterThanOrEqual(0);
    }
    const csv = recordsToCsv([record]);
    expect(csv.split('\n')[0]).toContain('seed');
    expect(csv).toContain('genesis');
  });

  it('summarizes solo win rates with a Wilson interval', () => {
    const interval = wilsonInterval(4, 12);
    expect(interval.p).toBeCloseTo(4 / 12);
    expect(interval.low).toBeLessThan(interval.p);
    expect(interval.high).toBeGreaterThan(interval.p);
    const made = (winner: string) =>
      runOneGame({
        seed: 3,
        difficulty: 'normal',
        events: false,
        allied: false,
        playerSeat: 'helm',
        maxTurns: 1,
        stallRounds: 40,
      });
    const sample = made('helm');
    sample.status = 'finished';
    sample.victory = 'solo';
    sample.winner = ['verdantia'];
    const other = { ...sample, seed: 4, winner: ['helm'] as typeof sample.winner, factions: sample.factions };
    const summary = summarize([sample, other]);
    expect(summary.finished).toBe(2);
    expect(summary.byFaction.find((row) => row.faction === 'verdantia')?.soloWins).toBe(1);
    expect(summary.byFaction.find((row) => row.faction === 'helm')?.soloWins).toBe(1);
  });

  it('flags a non-positive stockpile', () => {
    const game = Game.newGame({ seed: 5, player: 'helm', difficulty: 'normal' });
    game.state.factions.clio.credits = -3;
    expect(invalidState(game).join(' ')).toContain('clio credits');
  });
});
