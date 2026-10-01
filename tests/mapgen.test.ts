import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { isHostileClimate, softenTile } from '../src/core/geography';
import { isSea } from '../src/core/rules';
import { tileYield } from '../src/core/economy';
import { FACTION_IDS } from '../src/core/types';

describe('continent map', () => {
  it('builds oceans, varied land, rivers, and specials, with starts that can reach each other', () => {
    const game = Game.newGame({ seed: 3, player: 'helm' });
    const tiles = game.state.tiles;
    const sea = tiles.filter((tile) => isSea(tile.terrain)).length / tiles.length;
    expect(sea).toBeGreaterThan(0.22);
    expect(sea).toBeLessThan(0.62);
    expect(new Set(tiles.map((tile) => tile.terrain)).size).toBeGreaterThanOrEqual(8);
    expect(tiles.some((tile) => tile.river)).toBe(true);
    expect(tiles.some((tile) => tile.special)).toBe(true);
    expect(tiles.some((tile) => tile.resource)).toBe(true);
    for (const tile of tiles) {
      expect(tile).not.toHaveProperty('zone');
      expect(tile).not.toHaveProperty('livable');
      expect(tile.elevation).toBeGreaterThanOrEqual(0);
      expect(tile.elevation).toBeLessThanOrEqual(1);
    }
    const homes = FACTION_IDS.map((id) => game.unitsOf(id)[0]);
    const seen = new Set<string>();
    const queue = [{ x: homes[0].x, y: homes[0].y }];
    seen.add(`${homes[0].x},${homes[0].y}`);
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cur.x + dx;
          const y = cur.y + dy;
          if (!game.inBounds(x, y) || seen.has(`${x},${y}`)) continue;
          if (isSea(game.tile(x, y).terrain)) continue;
          seen.add(`${x},${y}`);
          queue.push({ x, y });
        }
      }
    }
    for (const home of homes) expect(seen.has(`${home.x},${home.y}`)).toBe(true);
  });

  it('softens hostile ground and pays extra energy for geothermal wells', () => {
    const game = Game.newGame({ seed: 4, player: 'helm' });
    const tile = game.tile(2, 2);
    tile.terrain = 'scorched';
    tile.river = false;
    tile.resource = null;
    tile.special = null;
    tile.improvement = null;
    expect(isHostileClimate(tile.terrain)).toBe(true);
    softenTile(tile);
    expect(isHostileClimate(tile.terrain)).toBe(false);
    tile.terrain = 'rocky';
    const plain = tileYield(tile);
    const boosted = tileYield(tile, ['geothermal-grid']);
    expect(boosted.energy).toBe(plain.energy + 2);
  });

  it('keeps a last-seen snapshot after the scout moves on', () => {
    const game = Game.newGame({ seed: 6, player: 'helm' });
    const scout = game.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    const origin = { x: scout.x, y: scout.y };
    const step = game.reachable(scout.id);
    const far = [...step.keys()].map((key) => key.split(',').map(Number)).find(([x, y]) => Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) >= 2);
    expect(far).toBeTruthy();
    expect(game.moveUnit(scout.id, far![0], far![1]).ok).toBe(true);
    const memory = game.state.recall?.helm[origin.y * game.state.width + origin.x];
    expect(memory?.terrain).toBe(game.tile(origin.x, origin.y).terrain);
    expect(game.isExplored('helm', origin.x, origin.y)).toBe(true);
  });
});
