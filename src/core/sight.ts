import { FACTION_IDS, type FactionId, type GameState, type Recall, type Tile, type Unit } from './types';
import type { City } from './types';

export function emptyRecallGrid(count: number): (Recall | null)[] {
  return Array.from({ length: count }, () => null);
}

export function snapshotRecall(tile: Tile, city: City | undefined, units: readonly Unit[]): Recall {
  return {
    terrain: tile.terrain,
    elevation: tile.elevation,
    rainfall: tile.rainfall,
    temperature: tile.temperature,
    river: tile.river,
    resource: tile.resource,
    special: tile.special,
    improvement: tile.improvement,
    road: tile.road,
    scarred: tile.scarred,
    working: units.some((unit) => unit.terraform != null),
    city: city
      ? { id: city.id, name: city.name, factionId: city.factionId, population: city.population }
      : null,
    units: units.map((unit) => ({
      id: unit.id,
      factionId: unit.factionId,
      role: unit.role,
      domain: unit.domain,
      name: unit.name,
    })),
  };
}

export function ensureRecall(state: GameState): Record<FactionId, (Recall | null)[]> {
  const count = state.width * state.height;
  if (!state.recall) {
    state.recall = {} as Record<FactionId, (Recall | null)[]>;
  }
  for (const id of FACTION_IDS) {
    const grid = state.recall[id];
    if (!grid || grid.length !== count) state.recall[id] = emptyRecallGrid(count);
  }
  return state.recall;
}
