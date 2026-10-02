import { CONFIG, MAP_SIZES, mapSpec, type MapSizeId } from '../config';
import { isHostileClimate, settleScore } from './geography';
import type { Rng } from './rng';
import { isSea } from './rules';
import type { FactionId, ResourceId, SpecialId, TerrainId, Tile } from './types';

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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

function blobHeight(nx: number, ny: number, blob: Blob): number {
  const dx = (nx - blob.x) / blob.rx;
  const dy = (ny - blob.y) / blob.ry;
  return Math.exp(-(dx * dx + dy * dy));
}

/** A raised saddle so the landmasses stay walkable for land units. */
function saddle(nx: number, ny: number, a: Blob, b: Blob, width: number): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((nx - a.x) * abx + (ny - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + abx * t;
  const py = a.y + aby * t;
  const dist = Math.hypot(nx - px, ny - py);
  const along = Math.sin(t * Math.PI);
  return Math.exp(-(dist * dist) / (width * width)) * along * 0.72;
}

/** Medium keeps the original three landmasses. Small uses two broader ones; large adds a fourth. */
function continentBlobs(seed: number, count: number): Blob[] {
  const broad = count <= 2;
  const blobs: Blob[] = [
    {
      x: 0.4 + (hash(1, 2, seed) - 0.5) * 0.08,
      y: 0.48 + (hash(2, 3, seed) - 0.5) * 0.08,
      rx: broad ? 0.36 : 0.3,
      ry: broad ? 0.42 : 0.36,
    },
    {
      x: 0.72 + (hash(3, 4, seed) - 0.5) * 0.05,
      y: 0.3 + (hash(4, 5, seed) - 0.5) * 0.06,
      rx: broad ? 0.22 : 0.16,
      ry: broad ? 0.24 : 0.18,
    },
  ];
  if (count >= 3) {
    blobs.push({
      x: 0.22 + (hash(5, 6, seed) - 0.5) * 0.05,
      y: 0.74 + (hash(6, 7, seed) - 0.5) * 0.05,
      rx: 0.15,
      ry: 0.16,
    });
  }
  if (count >= 4) {
    blobs.push({
      x: 0.78 + (hash(7, 8, seed) - 0.5) * 0.04,
      y: 0.72 + (hash(8, 9, seed) - 0.5) * 0.04,
      rx: 0.15,
      ry: 0.16,
    });
  }
  return blobs;
}

function seaTerrain(temperature: number): TerrainId {
  if (temperature > 0.72) return 'hot-sea';
  if (temperature < 0.28) return 'frozen-sea';
  return 'temperate-sea';
}

function landTerrain(elevation: number, rainfall: number, temperature: number, spot: number): TerrainId {
  if (elevation > 0.86) return temperature < 0.32 ? 'ice-ridge' : 'mountain';
  if (elevation > 0.78 && temperature > 0.82 && spot > 0.55) return 'lava';
  if (elevation > 0.74 && rainfall < 0.4) return 'ridge';
  if (temperature < 0.22) return elevation > 0.66 ? 'ice-ridge' : 'frozen-plain';
  if (temperature > 0.8 && rainfall < 0.28) return elevation > 0.6 ? 'scorched' : 'dunes';
  if (elevation > 0.7 && rainfall < 0.32 && temperature > 0.62) return 'thin-air';
  if (spot > 0.965) return 'alien-growth';
  if (rainfall > 0.62 && rainfall < 0.7 && spot > 0.9) return 'toxic';
  if (elevation > 0.68 && rainfall < 0.34) return 'canyon';
  if (elevation > 0.66) return rainfall > 0.55 ? 'highlands' : 'rocky';
  if (rainfall > 0.66 && temperature > 0.34 && temperature < 0.75) return 'forest';
  if (rainfall < 0.28) return 'rocky';
  if (elevation > 0.6) return 'highlands';
  return 'grass';
}

export interface GeneratedMap {
  width: number;
  height: number;
  tiles: Tile[];
  starts: { faction: FactionId; x: number; y: number }[];
}

export function generateMap(rng: Rng, factions: readonly FactionId[], seed: number, size?: MapSizeId): GeneratedMap {
  const spec = mapSpec(size);
  const width = spec.width;
  const height = spec.height;
  const blobs = continentBlobs(seed, spec.continents);
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / (width - 1);
      const ny = y / (height - 1);
      let mask = 0;
      for (const blob of blobs) mask = Math.max(mask, blobHeight(nx, ny, blob));
      if (blobs.length >= 2) mask = Math.max(mask, saddle(nx, ny, blobs[0], blobs[1], 0.07));
      if (blobs.length >= 3) mask = Math.max(mask, saddle(nx, ny, blobs[0], blobs[2], 0.065));
      if (blobs.length >= 4) mask = Math.max(mask, saddle(nx, ny, blobs[0], blobs[3], 0.06));
      const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
      const shore = Math.min(1, edge / 0.07);
      const n = fbm(x * 0.085, y * 0.085, seed);
      const chains = fbm(x * 0.045, y * 0.16, seed + 3);
      const elevation = clamp01((mask * 0.78 + n * 0.34 + (chains > 0.74 ? 0.1 : 0)) * shore);
      const rainfall = clamp01(fbm(x * 0.07 + 20, y * 0.08, seed + 11));
      const temperature = clamp01(0.48 + (fbm(x * 0.06 + 8, y * 0.055, seed + 21) - 0.5) * 0.85 + (0.5 - ny) * 0.1);
      const spot = hash(x, y, seed + 99);
      let terrain: TerrainId = elevation < 0.4 ? seaTerrain(temperature) : landTerrain(elevation, rainfall, temperature, spot);
      tiles.push({
        x,
        y,
        terrain,
        elevation,
        rainfall,
        temperature,
        river: false,
        resource: null,
        special: null,
        improvement: null,
        road: false,
        scarred: false,
        history: [],
      });
    }
  }
  for (const tile of tiles) {
    if (isSea(tile.terrain)) continue;
    if (tile.terrain === 'mountain' || tile.terrain === 'ridge' || tile.terrain === 'lava' || tile.terrain === 'ice-ridge') continue;
    const nearSea = neighbors(tile.x, tile.y, width, height).some((n) => isSea(at(tiles, width, n.x, n.y).terrain));
    if (nearSea && tile.elevation < 0.52 && (tile.terrain === 'grass' || tile.terrain === 'dunes' || tile.terrain === 'scorched' || tile.terrain === 'frozen-plain' || tile.terrain === 'rocky')) {
      tile.terrain = 'coast';
    }
  }
  const medium = width === MAP_SIZES.medium.width && height === MAP_SIZES.medium.height;
  const riverLimit = medium ? 22 : Math.max(10, Math.round((22 * width * height) / (MAP_SIZES.medium.width * MAP_SIZES.medium.height)));
  const riverSteps = medium ? 70 : Math.max(40, Math.round((70 * Math.max(width, height)) / MAP_SIZES.medium.width));
  carveRivers(tiles, width, height, seed, riverLimit, riverSteps);
  for (const tile of tiles) {
    if (isSea(tile.terrain)) continue;
    rollDeposit(rng, tile);
  }
  const starts = placeStarts(tiles, width, height, factions, rng, spec.minStartDistance);
  connectStarts(tiles, width, height, starts);
  for (const start of starts) prepareStart(tiles, width, height, start.x, start.y);
  return { width, height, tiles, starts };
}

function rollDeposit(rng: Rng, tile: Tile) {
  if (rng.next() < 0.04) tile.special = rollSpecial(rng, tile.terrain);
  if (tile.special && rng.next() < 0.45) return;
  if (rng.next() > 0.09) return;
  tile.resource = rollResource(rng, tile.terrain);
}

function rollResource(rng: Rng, terrain: TerrainId): ResourceId {
  const roll = rng.next();
  if (terrain === 'rocky' || terrain === 'mountain' || terrain === 'ridge' || terrain === 'canyon') {
    return roll < 0.75 ? 'minerals' : 'ark-debris';
  }
  if (terrain === 'forest' || terrain === 'grass' || terrain === 'coast') {
    if (roll < 0.55) return 'nutrients';
    if (roll < 0.8) return 'minerals';
    return 'energy';
  }
  if (terrain === 'scorched' || terrain === 'dunes' || terrain === 'lava' || terrain === 'thin-air') {
    return roll < 0.65 ? 'energy' : 'minerals';
  }
  if (terrain === 'frozen-plain' || terrain === 'ice-ridge') return roll < 0.5 ? 'minerals' : 'ark-debris';
  if (roll < 0.4) return 'nutrients';
  if (roll < 0.7) return 'minerals';
  if (roll < 0.9) return 'energy';
  return 'ark-debris';
}

function rollSpecial(rng: Rng, terrain: TerrainId): SpecialId {
  const roll = rng.next();
  if (terrain === 'forest' || terrain === 'alien-growth' || terrain === 'grass') {
    return roll < 0.55 ? 'spores' : 'cache';
  }
  if (terrain === 'lava' || terrain === 'scorched' || terrain === 'thin-air') return roll < 0.6 ? 'vent' : 'crystal';
  if (terrain === 'rocky' || terrain === 'mountain' || terrain === 'canyon' || terrain === 'ridge') {
    return roll < 0.7 ? 'crystal' : 'cache';
  }
  if (roll < 0.34) return 'crystal';
  if (roll < 0.67) return 'spores';
  return 'vent';
}

function carveRivers(tiles: Tile[], width: number, height: number, seed: number, limit: number, steps: number) {
  const sources = tiles.filter(
    (tile) => !isSea(tile.terrain) && tile.elevation > 0.6 && tile.rainfall > 0.55 && hash(tile.x, tile.y, seed + 7) > 0.62,
  );
  sources.sort((a, b) => b.elevation - a.elevation || a.y - b.y || a.x - b.x);
  for (const source of sources.slice(0, limit)) {
    let x = source.x;
    let y = source.y;
    const seen = new Set<string>();
    for (let step = 0; step < steps; step++) {
      const tile = at(tiles, width, x, y);
      if (isSea(tile.terrain)) break;
      tile.river = true;
      seen.add(`${x},${y}`);
      let best: { x: number; y: number; elevation: number } | null = null;
      for (const n of neighbors(x, y, width, height)) {
        if (seen.has(`${n.x},${n.y}`)) continue;
        const next = at(tiles, width, n.x, n.y);
        const elev = isSea(next.terrain) ? -1 : next.elevation;
        if (!best || elev < best.elevation) best = { x: n.x, y: n.y, elevation: elev };
      }
      if (!best || best.elevation >= tile.elevation - 0.0005) break;
      x = best.x;
      y = best.y;
    }
  }
}

function placeStarts(
  tiles: Tile[],
  width: number,
  height: number,
  factions: readonly FactionId[],
  rng: Rng,
  minStartDistance: number = CONFIG.map.minStartDistance,
): { faction: FactionId; x: number; y: number }[] {
  const candidates = tiles.filter((tile) => settleScore(tile) >= 4 && !isHostileClimate(tile.terrain));
  const poolSource = candidates.length >= factions.length ? candidates : tiles.filter((tile) => !isSea(tile.terrain) && tile.terrain !== 'mountain' && tile.terrain !== 'lava');
  const order = [...factions];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  let minDist = minStartDistance;
  let chosen: Tile[] = [];
  while (minDist >= 4 && chosen.length < factions.length) {
    chosen = [];
    const pool = [...poolSource];
    const first = pool.splice(rng.int(pool.length), 1)[0];
    chosen.push(first);
    while (chosen.length < factions.length && pool.length) {
      let bestIndex = 0;
      let bestScore = -1;
      let bestSep = 0;
      for (let i = 0; i < pool.length; i++) {
        const sep = Math.min(...chosen.map((c) => chebyshev(c, pool[i])));
        const score = sep * 10 + settleScore(pool[i]);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
          bestSep = sep;
        }
      }
      if (bestSep < minDist) break;
      chosen.push(pool.splice(bestIndex, 1)[0]);
    }
    if (chosen.length < factions.length) minDist -= 1;
  }
  const used = new Set(chosen.map((tile) => `${tile.x},${tile.y}`));
  while (chosen.length < factions.length) {
    let best: Tile | null = null;
    let bestSep = -1;
    let bestScore = -1;
    for (const tile of poolSource) {
      const key = `${tile.x},${tile.y}`;
      if (used.has(key)) continue;
      const sep = chosen.length ? Math.min(...chosen.map((other) => chebyshev(other, tile))) : width + height;
      const score = settleScore(tile);
      if (sep > bestSep || (sep === bestSep && score > bestScore)) {
        best = tile;
        bestSep = sep;
        bestScore = score;
      }
    }
    if (!best) break;
    used.add(`${best.x},${best.y}`);
    chosen.push(best);
  }
  return chosen.slice(0, factions.length).map((tile, i) => ({ faction: order[i], x: tile.x, y: tile.y }));
}

function connectStarts(tiles: Tile[], width: number, height: number, starts: { x: number; y: number }[]) {
  if (!starts.length) return;
  const key = (x: number, y: number) => `${x},${y}`;
  const reachable = new Set<string>();
  const queue = [starts[0]];
  reachable.add(key(starts[0].x, starts[0].y));
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const n of neighbors(cur.x, cur.y, width, height)) {
      const id = key(n.x, n.y);
      if (reachable.has(id)) continue;
      if (isSea(at(tiles, width, n.x, n.y).terrain)) continue;
      reachable.add(id);
      queue.push(n);
    }
  }
  for (const start of starts) {
    if (reachable.has(key(start.x, start.y))) continue;
    const path = pathToReachable(tiles, width, height, start, reachable);
    for (const step of path) {
      const tile = at(tiles, width, step.x, step.y);
      if (isSea(tile.terrain) || tile.terrain === 'mountain' || tile.terrain === 'lava') {
        tile.terrain = 'coast';
        tile.elevation = Math.max(tile.elevation, 0.46);
      }
      reachable.add(key(step.x, step.y));
      for (const n of neighbors(step.x, step.y, width, height)) {
        if (!isSea(at(tiles, width, n.x, n.y).terrain)) reachable.add(key(n.x, n.y));
      }
    }
  }
}

function pathToReachable(
  tiles: Tile[],
  width: number,
  height: number,
  origin: { x: number; y: number },
  reachable: Set<string>,
): { x: number; y: number }[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, string | null>();
  const queue = [origin];
  prev.set(key(origin.x, origin.y), null);
  let hit: string | null = null;
  for (let i = 0; i < queue.length && !hit; i++) {
    const cur = queue[i];
    for (const n of neighbors(cur.x, cur.y, width, height)) {
      const id = key(n.x, n.y);
      if (prev.has(id)) continue;
      prev.set(id, key(cur.x, cur.y));
      if (reachable.has(id)) {
        hit = id;
        break;
      }
      queue.push(n);
    }
  }
  if (!hit) return [];
  const path: { x: number; y: number }[] = [];
  let cursor: string | null = hit;
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.push({ x, y });
    cursor = prev.get(cursor) ?? null;
  }
  return path;
}

function prepareStart(tiles: Tile[], width: number, height: number, x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const tile = at(tiles, width, nx, ny);
      if (isSea(tile.terrain) || tile.terrain === 'lava' || tile.terrain === 'mountain' || isHostileClimate(tile.terrain)) {
        tile.terrain = 'grass';
        tile.elevation = Math.max(tile.elevation, 0.5);
        tile.temperature = 0.52;
        tile.rainfall = Math.max(tile.rainfall, 0.5);
      }
    }
  }
  const center = at(tiles, width, x, y);
  center.terrain = 'grass';
  center.elevation = Math.max(center.elevation, 0.5);
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
