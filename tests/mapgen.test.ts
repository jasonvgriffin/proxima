import { describe, expect, it } from 'vitest';
import { CONFIG, MAP_SIZES, MAP_SIZE_IDS, type MapSizeId } from '../src/config';
import { Game } from '../src/core/game';
import { isHostileClimate, settleScore, softenTile } from '../src/core/geography';
import { isSea } from '../src/core/rules';
import { fogCanvasSize } from '../src/render/fog';
import { chunkCount, minimapPixels } from '../src/render/terrain';
import { tileYield } from '../src/core/economy';
import { FACTION_IDS, type FactionId } from '../src/core/types';

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

function homes(game: Game): { id: FactionId; x: number; y: number }[] {
  return FACTION_IDS.map((id) => {
    const unit = game.unitsOf(id)[0];
    return { id, x: unit.x, y: unit.y };
  });
}

function landLinked(game: Game, points: { x: number; y: number }[]): boolean {
  const seen = new Set<string>();
  const queue = [{ x: points[0].x, y: points[0].y }];
  seen.add(`${points[0].x},${points[0].y}`);
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cur.x + dx;
        const y = cur.y + dy;
        const key = `${x},${y}`;
        if (!game.inBounds(x, y) || seen.has(key) || isSea(game.tile(x, y).terrain)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
  }
  return points.every((point) => seen.has(`${point.x},${point.y}`));
}

describe('map sizes', () => {
  it('keeps medium as the original 60 by 40 default', () => {
    expect(MAP_SIZES.medium.width).toBe(CONFIG.map.width);
    expect(MAP_SIZES.medium.height).toBe(CONFIG.map.height);
    expect(MAP_SIZES.medium.minStartDistance).toBe(CONFIG.map.minStartDistance);
    const game = Game.newGame({ seed: 3, player: 'helm' });
    expect(game.state.mapSize).toBe('medium');
    expect(game.state.width).toBe(60);
    expect(game.state.height).toBe(40);
    expect(game.state.tiles).toHaveLength(60 * 40);
  });

  it('gives every faction a fair, separated land start on each size', () => {
    const seeds = [1, 2, 3, 7, 11, 19, 42, 100];
    for (const size of MAP_SIZE_IDS) {
      const spec = MAP_SIZES[size];
      for (const seed of seeds) {
        const game = Game.newGame({ seed, player: 'helm', mapSize: size as MapSizeId });
        expect(game.state.mapSize, `${size} ${seed}`).toBe(size);
        expect(game.state.width, `${size} ${seed}`).toBe(spec.width);
        expect(game.state.height, `${size} ${seed}`).toBe(spec.height);
        expect(game.state.tiles, `${size} ${seed}`).toHaveLength(spec.width * spec.height);
        const sea = game.state.tiles.filter((tile) => isSea(tile.terrain)).length / game.state.tiles.length;
        expect(sea, `${size} ${seed} sea`).toBeGreaterThan(0.15);
        expect(sea, `${size} ${seed} sea`).toBeLessThan(0.7);
        expect(game.state.tiles.some((tile) => tile.river), `${size} ${seed} river`).toBe(true);
        const starts = homes(game);
        expect(new Set(starts.map((home) => home.id)).size, `${size} ${seed}`).toBe(FACTION_IDS.length);
        const spots = new Set(starts.map((home) => `${home.x},${home.y}`));
        expect(spots.size, `${size} ${seed} stacked`).toBe(FACTION_IDS.length);
        for (const home of starts) {
          const tile = game.tile(home.x, home.y);
          expect(isSea(tile.terrain), `${size} ${seed} ${home.id}`).toBe(false);
          expect(isHostileClimate(tile.terrain), `${size} ${seed} ${home.id}`).toBe(false);
          expect(tile.terrain, `${size} ${seed} ${home.id}`).toBe('grass');
          expect(settleScore(tile), `${size} ${seed} ${home.id}`).toBeGreaterThanOrEqual(8);
          expect(game.unitsOf(home.id), `${size} ${seed} ${home.id}`).toHaveLength(3);
        }
        for (let i = 0; i < starts.length; i++) {
          for (let j = i + 1; j < starts.length; j++) {
            const dist = Math.max(Math.abs(starts[i].x - starts[j].x), Math.abs(starts[i].y - starts[j].y));
            expect(dist, `${size} seed ${seed} ${starts[i].id} vs ${starts[j].id}`).toBeGreaterThanOrEqual(spec.minStartDistance);
          }
        }
        expect(landLinked(game, starts), `${size} ${seed} linked`).toBe(true);
      }
    }
  });

  it('scales chunk, fog, and minimap dimensions with the map', () => {
    expect(chunkCount(60, 40)).toEqual({ cols: 8, rows: 5 });
    expect(chunkCount(42, 28)).toEqual({ cols: 6, rows: 4 });
    expect(chunkCount(90, 60)).toEqual({ cols: 12, rows: 8 });
    expect(minimapPixels(60, 40)).toEqual({ width: 168, height: 112 });
    expect(minimapPixels(42, 28)).toEqual({ width: 168, height: 112 });
    expect(minimapPixels(90, 60)).toEqual({ width: 168, height: 112 });
    expect(fogCanvasSize(60, 40)).toEqual({ width: 240, height: 160 });
    expect(fogCanvasSize(42, 28)).toEqual({ width: 168, height: 112 });
    expect(fogCanvasSize(90, 60)).toEqual({ width: 360, height: 240 });
    for (const size of MAP_SIZE_IDS) {
      const spec = MAP_SIZES[size];
      const chunks = chunkCount(spec.width, spec.height);
      expect(chunks.cols * 8).toBeGreaterThanOrEqual(spec.width);
      expect(chunks.rows * 8).toBeGreaterThanOrEqual(spec.height);
      const fog = fogCanvasSize(spec.width, spec.height);
      expect(fog.width / spec.width).toBe(fog.height / spec.height);
      const mini = minimapPixels(spec.width, spec.height);
      expect(mini.width / mini.height).toBeCloseTo(spec.width / spec.height, 1);
    }
  });
});
