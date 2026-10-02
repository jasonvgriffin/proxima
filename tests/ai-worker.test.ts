import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { computeRoundOrders } from '../src/ai/orders';
import { Game } from '../src/core/game';
import type { FactionId, MapSizeId } from '../src/core/types';

const require = createRequire(import.meta.url);
const { contentSecurityPolicy } = require('../shared/security.cjs') as {
  contentSecurityPolicy: (dev: boolean) => string;
};

function playDirect(seed: number, mapSize: MapSizeId, rounds: number, randomEvents: boolean) {
  const game = Game.newGame({ seed, player: 'helm', mapSize, randomEvents });
  for (let i = 0; i < rounds; i++) game.endTurn();
  return game.snapshot();
}

async function playOffThread(seed: number, mapSize: MapSizeId, rounds: number, randomEvents: boolean) {
  const game = Game.newGame({ seed, player: 'helm', mapSize, randomEvents });
  for (let i = 0; i < rounds; i++) {
    await game.endTurnWith(async (state, order) => computeRoundOrders(state, order));
  }
  return game.snapshot();
}

describe('AI worker orders', () => {
  it('matches an in-thread rival round for the same seed', async () => {
    const cases: { seed: number; mapSize: MapSizeId; rounds: number; randomEvents: boolean }[] = [
      { seed: 4, mapSize: 'medium', rounds: 2, randomEvents: false },
      { seed: 11, mapSize: 'medium', rounds: 2, randomEvents: true },
      { seed: 5, mapSize: 'small', rounds: 1, randomEvents: true },
      { seed: 8, mapSize: 'large', rounds: 1, randomEvents: false },
    ];
    for (const item of cases) {
      const direct = playDirect(item.seed, item.mapSize, item.rounds, item.randomEvents);
      const offThread = await playOffThread(item.seed, item.mapSize, item.rounds, item.randomEvents);
      expect(offThread, `${item.mapSize} seed ${item.seed}`).toEqual(direct);
    }
  });

  it('autosaves the board after rival orders are applied', async () => {
    const options = { seed: 11, player: 'helm' as const, mapSize: 'small' as const, autosaveEnabled: true, randomEvents: true };
    const direct = Game.newGame(options);
    const off = Game.newGame(options);
    let autosaved: ReturnType<Game['serialize']> | null = null;
    for (let turn = 1; turn <= 3; turn++) {
      const before = off.snapshot();
      const ended = await off.endTurnWith(async (state, order) => computeRoundOrders(state, order));
      direct.endTurn();
      expect(ended.autosave).toBe(turn === 3);
      expect(off.serialize()).toEqual(direct.serialize());
      if (ended.autosave) {
        autosaved = off.serialize();
        expect(autosaved.round).toBe(before.round + 1);
        expect(autosaved.playerTurnsCompleted).toBe(3);
        expect(autosaved).not.toEqual(before);
      }
    }
    expect(autosaved).not.toBeNull();
  });

  it('leaves the direct endTurn path for Node sims', () => {
    const game = Game.newGame({ seed: 2, player: 'verdantia', mapSize: 'small' });
    const ended = game.endTurn();
    expect(ended.ok).toBe(true);
    expect(ended.aiOrder).toHaveLength(5);
    expect(new Set(ended.aiOrder).size).toBe(5);
    expect(game.state.whoseTurn).toBe('verdantia' satisfies FactionId);
    expect(game.state.round).toBe(2);
  });

  it('allows the AI worker in the packaged page without opening the sandbox', () => {
    const dev = contentSecurityPolicy(true);
    const prod = contentSecurityPolicy(false);
    expect(dev).toContain("worker-src 'self' blob: data: http://localhost:5173 http://127.0.0.1:5173");
    expect(prod).toContain("worker-src 'self' blob: data:");
    expect(prod).toContain("script-src 'self'");
    expect(prod).not.toContain('unsafe-eval');
  });
});
