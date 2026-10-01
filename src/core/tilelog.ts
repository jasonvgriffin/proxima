import { climateFromTerrain } from './geography';
import type { FactionId, ImprovementId, TerraformEntry, Tile, TileSight } from './types';

/** Newest entries stay. Older ones collapse into a single line. */
export const HISTORY_CAP = 8;

export function appendHistory(history: TerraformEntry[], entry: TerraformEntry): TerraformEntry[] {
  const next = [...history, entry];
  if (next.length <= HISTORY_CAP) return next;
  const keep = HISTORY_CAP - 1;
  const overflow = next.length - keep;
  const kept = next.slice(overflow);
  return [
    {
      round: next[0]?.round ?? entry.round,
      factionId: null,
      unitName: null,
      change: `${overflow} earlier changes were folded into this record.`,
    },
    ...kept,
  ];
}

/** Old saves omit history and the last-seen record. Both load empty. */
export function ensureTileRecords(state: { tiles?: unknown; sight?: unknown }): void {
  if (!state || typeof state !== 'object') return;
  if (Array.isArray(state.tiles)) {
    for (const tile of state.tiles) {
      if (!tile || typeof tile !== 'object') continue;
      const row = tile as { history?: unknown };
      if (!Array.isArray(row.history)) row.history = [];
    }
  }
  if (!state.sight || typeof state.sight !== 'object' || Array.isArray(state.sight)) {
    state.sight = {};
  }
  for (const value of Object.values(state.sight as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const sight = value as Record<string, unknown>;
    const terrain = typeof sight.terrain === 'string' ? sight.terrain : 'grass';
    if (typeof sight.elevation !== 'number' || typeof sight.rainfall !== 'number' || typeof sight.temperature !== 'number') {
      const climate = climateFromTerrain(terrain);
      if (typeof sight.elevation !== 'number') sight.elevation = climate.elevation;
      if (typeof sight.rainfall !== 'number') sight.rainfall = climate.rainfall;
      if (typeof sight.temperature !== 'number') sight.temperature = climate.temperature;
    }
    if (typeof sight.river !== 'boolean') sight.river = false;
    if (!('special' in sight)) sight.special = null;
    if (!Array.isArray(sight.history)) sight.history = [];
    delete sight.zone;
    delete sight.livable;
  }
}

export function sightFrom(tile: Tile, working: TileSight['working']): TileSight {
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
    history: (tile.history ?? []).map((entry) => ({ ...entry })),
    working,
  };
}

export function improvementLines(
  sight: Pick<TileSight, 'improvement' | 'road' | 'scarred' | 'terrain' | 'river' | 'special'>,
): string[] {
  const lines: string[] = [];
  if (sight.terrain === 'forest') lines.push('Forest');
  if (sight.improvement === 'farm') lines.push('Farm');
  else if (sight.improvement === 'mine') lines.push('Mine');
  else if (sight.improvement === 'solar') lines.push('Solar panels');
  else if (sight.improvement === 'plant-trees') lines.push('Planted trees');
  else if (sight.improvement === 'atmosphere') lines.push('Atmosphere');
  if (sight.road) lines.push('Road');
  if (sight.river) lines.push('River');
  if (sight.special) lines.push(sight.special);
  if (sight.scarred) lines.push('Reactor scar');
  return lines;
}

export function historyActor(entry: TerraformEntry, nameOf: (id: FactionId) => string): string {
  const faction = entry.factionId ? nameOf(entry.factionId) : 'The planet';
  return entry.unitName ? `${faction}, ${entry.unitName}` : faction;
}

export function projectNoun(project: ImprovementId): string {
  switch (project) {
    case 'plant-trees':
      return 'planted trees';
    case 'farm':
      return 'a farm';
    case 'mine':
      return 'a mine';
    case 'solar':
      return 'solar panels';
    case 'road':
      return 'a road';
    case 'atmosphere':
      return 'atmosphere';
    default:
      return 'terraforming';
  }
}
