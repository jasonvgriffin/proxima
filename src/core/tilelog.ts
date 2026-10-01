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
}

export function sightFrom(tile: Tile, working: TileSight['working']): TileSight {
  return {
    terrain: tile.terrain,
    zone: tile.zone,
    resource: tile.resource,
    improvement: tile.improvement,
    livable: tile.livable,
    road: tile.road,
    scarred: tile.scarred,
    history: tile.history.map((entry) => ({ ...entry })),
    working,
  };
}

export function improvementLines(sight: Pick<TileSight, 'improvement' | 'road' | 'livable' | 'zone' | 'scarred' | 'terrain'>): string[] {
  const lines: string[] = [];
  if (sight.terrain === 'forest') lines.push('Forest');
  if (sight.improvement === 'farm') lines.push('Farm');
  else if (sight.improvement === 'mine') lines.push('Mine');
  else if (sight.improvement === 'solar') lines.push('Solar panels');
  else if (sight.improvement === 'plant-trees') lines.push('Planted trees');
  else if (sight.improvement === 'atmosphere') lines.push('Atmosphere');
  if (sight.road) lines.push('Road');
  if (sight.scarred) lines.push('Reactor scar');
  if (sight.livable && sight.zone !== 'twilight') lines.push('Livable ground');
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
