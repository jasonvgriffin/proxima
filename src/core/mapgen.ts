import { CONFIG } from '../config';
import type { Rng } from './rng';
import { isSea, zoneForColumn } from './rules';
import type { FactionId, ResourceId, TerrainId, Tile, Zone } from './types';

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = fade(x - x0);
  const sy = fade(y - y0);
  const n00 = hash(x0, y0, seed);
  const n10 = hash(x0 + 1, y0, seed);
  const n01 = hash(x0, y0 + 1, seed);
  const n11 = hash(x0 + 1, y0 + 1, seed);
  const ix0 = n00 + (n10 - n00) * sx;
  const ix1 = n01 + (n11 - n01) * sx;
  return ix0 + (ix1 - ix0) * sy;
}

function fbm(x: number, y: number, seed: number): number {
  return noise(x, y, seed) * 0.62 + noise(x * 2.1, y * 2.1, seed + 17) * 0.28 + noise(x * 4.2, y * 4.2, seed + 41) * 0.1;
}

function seaFor(zone: Zone): TerrainId {
  if (zone === 'day') return 'hot-sea';
  if (zone === 'night') return 'frozen-sea';
  return 'temperate-sea';
}

function landTerrain(zone: Zone, elevation: number, moisture: number, belt: number, spot: number): TerrainId {
  if (zone === 'day') {
    if (elevation > 0.8) return 'lava';
    if (moisture > 0.74) return 'thin-air';
    if (moisture < 0.38) return 'dunes';
    return 'scorched';
  }
  if (zone === 'night') {
    if (elevation > 0.72) return 'ice-ridge';
    if (elevation > 0.8) return 'mountain';
    return 'frozen-plain';
  }
  if (belt > 0.62 && belt < 0.7) return 'toxic';
  if (spot > 0.93) return 'alien-growth';
  if (elevation > 0.82) return 'mountain';
  if (elevation > 0.74) return 'ridge';
  if (elevation > 0.66 && moisture < 0.4) return 'canyon';
  if (moisture > 0.68) return 'forest';
  if (moisture < 0.32) return 'rocky';
  if (elevation > 0.6) return 'highlands';
  return 'grass';
}

export interface GeneratedMap {
  width: number;
  height: number;
  tiles: Tile[];
  starts: { faction: FactionId; x: number; y: number }[];
}

export function generateMap(rng: Rng, factions: readonly FactionId[], seed: number): GeneratedMap {
  const width = CONFIG.map.width;
  const height = CONFIG.map.height;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const zone = zoneForColumn(x);
      const elevation = fbm(x * 0.16, y * 0.16, seed);
      const moisture = fbm(x * 0.16 + 30, y * 0.16, seed + 5);
      const belt = fbm(x * 0.05, y * 0.22, seed + 9);
      const spot = hash(x, y, seed + 99);
      let terrain: TerrainId;
      if (elevation < 0.4) terrain = seaFor(zone);
      else terrain = landTerrain(zone, elevation, moisture, belt, spot);
      const resource = rollResource(rng, terrain, zone);
      tiles.push({
        x,
        y,
        zone,
        terrain,
        resource,
        improvement: null,
        livable: zone === 'twilight',
        road: false,
        scarred: false,
      });
    }
  }
  for (const tile of tiles) {
    if (isSea(tile.terrain)) continue;
    if (tile.terrain === 'mountain' || tile.terrain === 'ridge' || tile.terrain === 'lava') continue;
    const nearSea = neighbors(tile.x, tile.y, width, height).some((n) => isSea(at(tiles, width, n.x, n.y).terrain));
    if (nearSea && (tile.terrain === 'grass' || tile.terrain === 'scorched' || tile.terrain === 'frozen-plain' || tile.terrain === 'dunes')) {
      tile.terrain = 'coast';
    }
  }
  const starts = placeStarts(tiles, width, height, factions, rng);
  for (const start of starts) prepareStart(tiles, width, height, start.x, start.y);
  return { width, height, tiles, starts };
}

function rollResource(rng: Rng, terrain: TerrainId, zone: Zone): ResourceId | null {
  if (isSea(terrain)) return null;
  if (rng.next() > 0.09) return null;
  const roll = rng.next();
  if (terrain === 'rocky' || terrain === 'mountain' || terrain === 'ridge' || terrain === 'canyon') {
    return roll < 0.7 ? 'minerals' : 'ark-debris';
  }
  if (zone === 'day') return roll < 0.6 ? 'energy' : 'minerals';
  if (zone === 'night') return roll < 0.5 ? 'minerals' : 'ark-debris';
  if (roll < 0.4) return 'nutrients';
  if (roll < 0.65) return 'minerals';
  if (roll < 0.85) return 'energy';
  return 'ark-debris';
}

function placeStarts(
  tiles: Tile[],
  width: number,
  height: number,
  factions: readonly FactionId[],
  rng: Rng,
): { faction: FactionId; x: number; y: number }[] {
  const candidates = tiles.filter(
    (tile) => tile.zone === 'twilight' && !isSea(tile.terrain) && tile.terrain !== 'mountain' && tile.terrain !== 'lava',
  );
  const order = [...factions];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  let minDist = CONFIG.map.minStartDistance;
  let chosen: Tile[] = [];
  while (minDist >= 3 && chosen.length < factions.length) {
    chosen = [];
    const pool = [...candidates];
    const first = pool.splice(rng.int(pool.length), 1)[0];
    chosen.push(first);
    while (chosen.length < factions.length && pool.length) {
      let bestIndex = 0;
      let bestScore = -1;
      for (let i = 0; i < pool.length; i++) {
        const score = Math.min(...chosen.map((c) => chebyshev(c, pool[i])));
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      if (bestScore < minDist) break;
      chosen.push(pool.splice(bestIndex, 1)[0]);
    }
    if (chosen.length < factions.length) minDist -= 1;
  }
  while (chosen.length < factions.length) {
    chosen.push(candidates[rng.int(candidates.length)]);
  }
  return chosen.slice(0, factions.length).map((tile, i) => ({ faction: order[i], x: tile.x, y: tile.y }));
}

function prepareStart(tiles: Tile[], width: number, height: number, x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const tile = at(tiles, width, nx, ny);
      if (isSea(tile.terrain) || tile.terrain === 'lava' || tile.terrain === 'mountain') {
        tile.terrain = tile.zone === 'twilight' ? 'grass' : tile.zone === 'day' ? 'scorched' : 'frozen-plain';
      }
      tile.livable = tile.zone === 'twilight';
    }
  }
  const center = at(tiles, width, x, y);
  center.terrain = 'grass';
  center.livable = true;
  if (!center.resource) center.resource = 'nutrients';
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function at(tiles: Tile[], width: number, x: number, y: number): Tile {
  return tiles[y * width + x];
}

function neighbors(x: number, y: number, width: number, height: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      out.push({ x: nx, y: ny });
    }
  }
  return out;
}

export { neighbors as mapNeighbors };
