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
    if (unit.aboard != null) continue;
    if (unit.factionId !== mover.factionId) blocked.add(`${unit.x},${unit.y}`);
  }
  for (const city of cities) {
    if (city.factionId !== mover.factionId) blocked.add(`${city.x},${city.y}`);
  }
  return blocked;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Shortest path over the whole connected map. Empty array means the unit is already there. */
export function findPath(opts: {
  tiles: Tile[];
  width: number;
  height: number;
  origin: { x: number; y: number };
  goal: { x: number; y: number };
  domain: Domain;
  blocked: Set<string>;
}): { x: number; y: number }[] | null {
  const { tiles, width, height, origin, goal, domain, blocked } = opts;
  const start = origin.y * width + origin.x;
  const goalI = goal.y * width + goal.x;
  if (!Number.isFinite(start) || start < 0 || goalI < 0 || goalI >= width * height) return null;
  if (start === goalI) return [];
  const gScore = new Float64Array(width * height);
  gScore.fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(width * height);
  parent.fill(-1);
  const closed = new Uint8Array(width * height);
  gScore[start] = 0;
  const heap = new Heap<{ i: number; f: number }>((a, b) => a.f < b.f);
  heap.push({ i: start, f: heuristic(origin.x, origin.y, goal.x, goal.y) });
  while (heap.size) {
    const cur = heap.pop()!;
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    if (cur.i === goalI) break;
    const x = cur.i % width;
    const y = (cur.i / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        const step = moveCost(tiles[ni], domain);
        if (step == null) continue;
        if (blocked.has(`${nx},${ny}`) && ni !== goalI) continue;
        const g = gScore[cur.i] + step;
        if (g >= gScore[ni]) continue;
        gScore[ni] = g;
        parent[ni] = cur.i;
        const f = g + heuristic(nx, ny, goal.x, goal.y);
        heap.push({ i: ni, f });
      }
    }
  }
  if (parent[goalI] < 0) return null;
  const path: { x: number; y: number }[] = [];
  let i = goalI;
  while (i !== start) {
    path.push({ x: i % width, y: (i / width) | 0 });
    i = parent[i];
    if (i < 0) return null;
  }
  path.reverse();
  return path;
}

class Heap<T> {
  private data: T[] = [];

  constructor(private less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T) {
    this.data.push(item);
    this.bubble(this.data.length - 1);
  }

  pop(): T | undefined {
    if (!this.data.length) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length) {
      this.data[0] = last;
      this.sink(0);
    }
    return top;
  }

  private bubble(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(this.data[i], this.data[p])) break;
      const tmp = this.data[i];
      this.data[i] = this.data[p];
      this.data[p] = tmp;
      i = p;
    }
  }

  private sink(i: number) {
    const n = this.data.length;
    for (;;) {
      let s = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.less(this.data[l], this.data[s])) s = l;
      if (r < n && this.less(this.data[r], this.data[s])) s = r;
      if (s === i) break;
      const tmp = this.data[i];
      this.data[i] = this.data[s];
      this.data[s] = tmp;
      i = s;
    }
  }
}
