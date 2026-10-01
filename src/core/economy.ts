import { CONFIG } from '../config';
import { improvementYield, statMultiplier, stabilityMultiplier } from './rules';
import { yieldFlats } from './tech';
import type { FactionState, SocialStat, SpecialId, TerrainId, Tile } from './types';

const GEOTHERMAL: ReadonlySet<TerrainId> = new Set(['rocky', 'mountain', 'ridge', 'canyon', 'lava']);

const SPECIAL_YIELD: Record<SpecialId, { minerals: number; nutrients: number; energy: number; research: number }> = {
  crystal: { minerals: 2, nutrients: 0, energy: 0, research: 0 },
  spores: { minerals: 0, nutrients: 2, energy: 0, research: 0 },
  vent: { minerals: 0, nutrients: 0, energy: 2, research: 0 },
  cache: { minerals: 1, nutrients: 0, energy: 0, research: 2 },
};

export interface Yields {
  minerals: number;
  nutrients: number;
  energy: number;
  research: number;
}

export function zeroYields(): Yields {
  return { minerals: 0, nutrients: 0, energy: 0, research: 0 };
}

export function tileYield(tile: Tile, techs: readonly string[] = []): Yields {
  const base = CONFIG.terrainYield[tile.terrain] ?? zeroYields();
  const bonus = tile.resource ? CONFIG.resourceYield[tile.resource] : undefined;
  const extra = tile.improvement ? improvementYield(tile.improvement) : undefined;
  const special = tile.special ? SPECIAL_YIELD[tile.special] : undefined;
  const riverNutrients = tile.river ? 1 : 0;
  const geothermal = techs.includes('geothermal-grid') && GEOTHERMAL.has(tile.terrain) ? 2 : 0;
  return {
    minerals: base.minerals + (bonus?.minerals ?? 0) + (extra?.minerals ?? 0) + (special?.minerals ?? 0),
    nutrients: base.nutrients + (bonus?.nutrients ?? 0) + (extra?.nutrients ?? 0) + (special?.nutrients ?? 0) + riverNutrients,
    energy: base.energy + (bonus?.energy ?? 0) + (extra?.energy ?? 0) + (special?.energy ?? 0) + geothermal,
    research: base.research + (bonus?.research ?? 0) + (extra?.research ?? 0) + (special?.research ?? 0),
  };
}

export function scaleYield(yields: Yields, factor: number): Yields {
  return {
    minerals: yields.minerals * factor,
    nutrients: yields.nutrients * factor,
    energy: yields.energy * factor,
    research: yields.research * factor,
  };
}

export function socialScale(faction: FactionState, stat: SocialStat): number {
  return statMultiplier(faction.id, faction.axes, stat) * stabilityMultiplier(faction.stabilityTurns);
}

export function withTechFlats(yields: Yields, techs: readonly string[]): Yields {
  const bonus = yieldFlats(techs);
  return {
    minerals: yields.minerals + bonus.minerals,
    nutrients: yields.nutrients + bonus.nutrients,
    energy: yields.energy + bonus.energy,
    research: yields.research + bonus.research,
  };
}
