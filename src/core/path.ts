import { CONFIG } from '../config';
import { isSea } from './rules';
import type { Domain, Tile, Unit } from './types';

export interface Step {
  x: number;
  y: number;
  cost: number;
}

export function moveCost(tile: Tile, domain: Domain): number | null {
  const sea = isSea(tile.terrain);
  if (domain === 'sea') return sea ? 1 : null;
  if (sea) return null;
  if (tile.road) return 1;
  if (tile.terrain === 'mountain' || tile.terrain === 'ice-ridge' || tile.terrain === 'ridge' || tile.terrain === 'lava') {
    return CONFIG.roughMoveCost;
  }
  return CONFIG.moveDiagonalCost;
}

export function reachable(opts: {
  tiles: Tile[];
  width: number;
  height: number;
  origin: { x: number; y: number };
  moves: number;
  domain: Domain;
  blocked: Set<string>;
}): Map<string, { cost: number; path: { x: number; y: number }[] }> {
  const { tiles, width, height, origin, moves, domain, blocked } = opts;
  const key = (x: number, y: number) => `${x},${y}`;
  const best = new Map<string, { cost: number; path: { x: number; y: number }[] }>();
  const queue: { x: number; y: number; cost: number; path: { x: number; y: number }[] }[] = [
    { x: origin.x, y: origin.y, cost: 0, path: [] },
  ];
  best.set(key(origin.x, origin.y), { cost: 0, path: [] });
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.cost > (best.get(key(cur.x, cur.y))?.cost ?? 99)) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const tile = tiles[ny * width + nx];
        const step = moveCost(tile, domain);
        if (step == null) continue;
        const nk = key(nx, ny);
        if (blocked.has(nk)) continue;
        const cost = cur.cost + step;
        if (cost > moves) continue;
        const prev = best.get(nk);
        if (prev && prev.cost <= cost) continue;
        const path = [...cur.path, { x: nx, y: ny }];
        best.set(nk, { cost, path });
        queue.push({ x: nx, y: ny, cost, path });
      }
    }
  }
  return best;
}

export function blockedKeys(units: Unit[], cities: { x: number; y: number; factionId: string }[], mover: Unit): Set<string> {
  const blocked = new Set<string>();
  for (const unit of units) {
    if (unit.id === mover.id) continue;
    if (unit.factionId !== mover.factionId) blocked.add(`${unit.x},${unit.y}`);
  }
  for (const city of cities) {
    if (city.factionId !== mover.factionId) blocked.add(`${city.x},${city.y}`);
  }
  return blocked;
}
