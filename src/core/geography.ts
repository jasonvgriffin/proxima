import { tileYield } from './economy';
import { isSea } from './rules';
import type { TerrainId, Tile } from './types';

/** Climates a city cannot use until Sealed Habitats or atmosphere work. */
const HOSTILE: ReadonlySet<TerrainId> = new Set([
  'lava',
  'thin-air',
  'frozen-plain',
  'ice-ridge',
  'toxic',
  'scorched',
]);

/** Ground and water that wear a unit down each turn. */
const EXPOSED: ReadonlySet<TerrainId> = new Set([
  'lava',
  'thin-air',
  'frozen-plain',
  'ice-ridge',
  'toxic',
  'scorched',
  'hot-sea',
  'frozen-sea',
]);

const GEOTHERMAL: ReadonlySet<TerrainId> = new Set(['rocky', 'mountain', 'ridge', 'canyon', 'lava']);

const SOFTEN: Partial<Record<TerrainId, TerrainId>> = {
  scorched: 'grass',
  dunes: 'grass',
  toxic: 'grass',
  'frozen-plain': 'grass',
  'thin-air': 'highlands',
  lava: 'rocky',
  'ice-ridge': 'ridge',
};

export function isHostileClimate(terrain: TerrainId): boolean {
  return HOSTILE.has(terrain);
}

export function isExposed(terrain: TerrainId): boolean {
  return EXPOSED.has(terrain);
}

export function geothermalTerrain(terrain: TerrainId): boolean {
  return GEOTHERMAL.has(terrain);
}

export function exposureOutcome(
  hp: number,
  exposed: boolean,
  sealed: boolean,
  damage: number,
): { hp: number; destroyed: boolean } {
  if (!exposed || sealed) return { hp, destroyed: false };
  const next = hp - damage;
  return { hp: next, destroyed: next <= 0 };
}

/** Fill climate numbers when an old save only stored a terrain name. */
export function climateFromTerrain(terrain: string): { elevation: number; rainfall: number; temperature: number } {
  switch (terrain) {
    case 'hot-sea':
      return { elevation: 0.18, rainfall: 0.25, temperature: 0.86 };
    case 'frozen-sea':
      return { elevation: 0.18, rainfall: 0.4, temperature: 0.12 };
    case 'temperate-sea':
      return { elevation: 0.2, rainfall: 0.55, temperature: 0.5 };
    case 'mountain':
      return { elevation: 0.9, rainfall: 0.45, temperature: 0.35 };
    case 'ice-ridge':
      return { elevation: 0.86, rainfall: 0.4, temperature: 0.16 };
    case 'ridge':
      return { elevation: 0.78, rainfall: 0.35, temperature: 0.4 };
    case 'highlands':
      return { elevation: 0.66, rainfall: 0.45, temperature: 0.42 };
    case 'lava':
      return { elevation: 0.74, rainfall: 0.15, temperature: 0.92 };
    case 'scorched':
      return { elevation: 0.5, rainfall: 0.18, temperature: 0.84 };
    case 'dunes':
      return { elevation: 0.48, rainfall: 0.12, temperature: 0.78 };
    case 'thin-air':
      return { elevation: 0.8, rainfall: 0.2, temperature: 0.7 };
    case 'frozen-plain':
      return { elevation: 0.5, rainfall: 0.35, temperature: 0.18 };
    case 'toxic':
      return { elevation: 0.5, rainfall: 0.4, temperature: 0.55 };
    case 'forest':
      return { elevation: 0.55, rainfall: 0.78, temperature: 0.55 };
    case 'alien-growth':
      return { elevation: 0.52, rainfall: 0.7, temperature: 0.6 };
    case 'coast':
      return { elevation: 0.44, rainfall: 0.6, temperature: 0.55 };
    case 'canyon':
      return { elevation: 0.6, rainfall: 0.22, temperature: 0.6 };
    case 'rocky':
      return { elevation: 0.62, rainfall: 0.28, temperature: 0.5 };
    default:
      return { elevation: 0.52, rainfall: 0.55, temperature: 0.52 };
  }
}

/** Atmosphere work: harsh ground becomes something a city can use, and the slope eases. */
export function softenTile(tile: Tile): void {
  const next = SOFTEN[tile.terrain];
  if (next) tile.terrain = next;
  tile.rainfall = Math.min(1, tile.rainfall + 0.12);
  tile.temperature += (0.5 - tile.temperature) * 0.35;
  if (tile.elevation > 0.78) tile.elevation = Math.max(0.6, tile.elevation - 0.08);
  else if (tile.elevation < 0.42) tile.elevation = 0.46;
}

/** How attractive a tile is for a new city. Higher is better. Sea and peaks score 0. */
export function settleScore(tile: Tile): number {
  if (isSea(tile.terrain) || tile.terrain === 'mountain' || tile.terrain === 'lava') return 0;
  const yields = tileYield(tile);
  let score = yields.nutrients * 3 + yields.minerals * 2 + yields.energy * 2 + yields.research * 2;
  if (tile.river) score += 3;
  if (tile.terrain === 'grass' || tile.terrain === 'forest' || tile.terrain === 'coast') score += 2;
  if (isHostileClimate(tile.terrain)) score -= 6;
  return score;
}
