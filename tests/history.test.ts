import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { compareSocieties, summarizeDrift } from '../src/core/history';
import type { GameState } from '../src/core/types';

function newGame(seed = 3) {
  return Game.newGame({
    seed,
    player: 'helm',
    difficulty: 'normal',
    alliedVictory: false,
    randomEvents: false,
    autosaveEnabled: false,
  });
}

describe('social axis history', () => {
  it('records the opening week with no switches', () => {
    const game = newGame();
    const drift = game.state.axisDrift;
    expect(drift?.turns).toHaveLength(1);
    expect(drift?.turns[0].round).toBe(1);
    expect(drift?.turns[0].axes).toEqual(game.state.factions.helm.axes);
    expect(drift?.switches).toEqual([]);
  });

  it('keeps a sample for every week that begins, even when nothing changes', () => {
    const game = newGame(9);
    game.endTurn();
    game.endTurn();
    expect(game.state.round).toBe(3);
    expect(game.state.axisDrift?.turns.map((turn) => turn.round)).toEqual([1, 2, 3]);
    expect(game.state.axisDrift?.switches).toEqual([]);
    const values = game.state.axisDrift?.turns.map((turn) => turn.axes.values) ?? [];
    expect(new Set(values).size).toBe(1);
  });

  it('marks each switch with the week it happened and totals the matching bonus', () => {
    const game = newGame(4);
    game.endTurn();
    const fromValues = game.state.factions.helm.axes.values;
    const fromEconomy = game.state.factions.helm.axes.economy;
    game.state.factions.helm.credits = 250;
    expect(game.setSocial('values', 'dominance').ok).toBe(true);
    game.state.factions.helm.credits = 250;
    expect(game.setSocial('economy', 'market').ok).toBe(true);
    const drift = game.state.axisDrift!;
    expect(drift.switches).toEqual([
      { round: 2, axis: 'values', from: fromValues, to: 'dominance' },
      { round: 2, axis: 'economy', from: fromEconomy, to: 'market' },
    ]);
    expect(drift.turns.find((turn) => turn.round === 1)?.axes.values).toBe(fromValues);
    expect(drift.turns.find((turn) => turn.round === 2)?.axes).toMatchObject({
      values: 'dominance',
      economy: 'market',
    });
    const summary = summarizeDrift(drift, 'helm');
    expect(summary.switchCount).toBe(2);
    expect(summary.finalLabels.values).toBe('Dominance');
    expect(summary.finalLabels.economy).toBe('Market');
    expect(summary.finalMatchCount).toBe(2);
    expect(summary.finalBonus).toBeCloseTo(0.2);
    expect(summary.weeks).toBe(2);
    expect(summary.choiceWeeks).toBe(6);
    expect(summary.bonusWeeks).toBeCloseTo(0.6);
  });

  it('does not record a switch the player cannot afford', () => {
    const game = newGame();
    game.state.factions.helm.credits = 10;
    expect(game.setSocial('values', 'dominance').ok).toBe(false);
    expect(game.state.axisDrift?.switches).toEqual([]);
    expect(game.state.factions.helm.axes.values).not.toBe('dominance');
  });

  it('reloads a save that has no per-turn history', () => {
    const game = newGame(6);
    game.endTurn();
    game.state.factions.helm.credits = 200;
    expect(game.setSocial('politics', 'warlord').ok).toBe(true);
    game.endTurn();
    const legacy = JSON.parse(JSON.stringify(game.serialize())) as GameState;
    delete legacy.axisDrift;
    const loaded = Game.fromState(legacy);
    expect(loaded.state.axisDrift?.turns.map((turn) => turn.round)).toEqual([1, 2, 3]);
    expect(loaded.state.axisDrift?.switches).toEqual([
      { round: 2, axis: 'politics', from: 'council', to: 'warlord' },
    ]);
    expect(loaded.state.axisDrift?.turns[0].axes.politics).toBe('council');
    expect(loaded.state.axisDrift?.turns[1].axes.politics).toBe('warlord');
    expect(loaded.state.axisDrift?.turns[2].axes.politics).toBe('warlord');
  });

  it('reloads a save that has neither drift nor the older switch log', () => {
    const game = newGame(8);
    game.endTurn();
    game.endTurn();
    const legacy = JSON.parse(JSON.stringify(game.serialize())) as GameState;
    delete legacy.axisDrift;
    delete (legacy as Partial<GameState>).axisHistory;
    const loaded = Game.fromState(legacy);
    expect(loaded.state.axisDrift?.switches).toEqual([]);
    expect(loaded.state.axisDrift?.turns).toHaveLength(loaded.state.round);
    expect(loaded.state.axisDrift?.turns[0].axes).toEqual(loaded.state.factions.helm.axes);
  });

  it('does not duplicate switches when a recorded save is loaded', () => {
    const game = newGame(12);
    game.state.factions.helm.credits = 200;
    expect(game.setSocial('religion', 'none').ok).toBe(true);
    const loaded = Game.fromState(game.serialize());
    expect(loaded.state.axisDrift?.switches).toHaveLength(1);
    loaded.endTurn();
    expect(loaded.state.axisDrift?.switches).toHaveLength(1);
    expect(loaded.state.axisDrift?.turns.map((turn) => turn.round)).toEqual([1, 2]);
    expect(loaded.state.axisDrift?.turns[1].axes.religion).toBe('none');
  });

  it('compares the final stance with the other factions', () => {
    const game = newGame(1);
    const compared = compareSocieties('helm', game.state.factions.helm.axes, game.state.factions);
    expect(compared).toHaveLength(5);
    expect(compared.map((row) => row.id)).not.toContain('helm');
    expect(compared[0].shared).toBeGreaterThanOrEqual(compared[compared.length - 1].shared);
    expect(compared.find((row) => row.id === 'ironclad')?.shared).toBe(0);
    expect(compared.find((row) => row.id === 'clio')?.shared).toBe(1);
  });
});
