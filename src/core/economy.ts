import { CONFIG } from '../config';
import { improvementYield, statMultiplier, stabilityMultiplier } from './rules';
import { yieldFlats } from './tech';
import type { FactionState, SocialStat, Tile } from './types';

export interface Yields {
  minerals: number;
  nutrients: number;
  energy: number;
  research: number;
}

export function zeroYields(): Yields {
  return { minerals: 0, nutrients: 0, energy: 0, research: 0 };
}

export function tileYield(tile: Tile): Yields {
  const base = CONFIG.terrainYield[tile.terrain] ?? zeroYields();
  const bonus = tile.resource ? CONFIG.resourceYield[tile.resource] : undefined;
  const extra = tile.improvement ? improvementYield(tile.improvement) : undefined;
  return {
    minerals: base.minerals + (bonus?.minerals ?? 0) + (extra?.minerals ?? 0),
    nutrients: base.nutrients + (bonus?.nutrients ?? 0) + (extra?.nutrients ?? 0),
    energy: base.energy + (bonus?.energy ?? 0) + (extra?.energy ?? 0),
    research: base.research + (bonus?.research ?? 0) + (extra?.research ?? 0),
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
