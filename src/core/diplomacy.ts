import { CONFIG } from '../config';
import type { FactionId, Proposal, Relation, SocialAxes, Stance } from './types';

export function pairOf(a: FactionId, b: FactionId): [FactionId, FactionId] {
  return a < b ? [a, b] : [b, a];
}

export function initialRelations(ids: readonly FactionId[]): Relation[] {
  const out: Relation[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = pairOf(ids[i], ids[j]);
      out.push({ a, b, stance: 'peace', research: false, exploration: false, memory: 0 });
    }
  }
  return out;
}

export function findRelation(relations: readonly Relation[], a: FactionId, b: FactionId): Relation | undefined {
  const [x, y] = pairOf(a, b);
  return relations.find((rel) => rel.a === x && rel.b === y);
}

/** War, then peace, then a pact, then an alliance. Treaties sit beside peace and above. */
export function canSetStance(current: Stance, next: Stance): { ok: boolean; reason: string } {
  if (next === current) return { ok: false, reason: 'That is already the standing between you.' };
  if (next === 'war') return { ok: true, reason: '' };
  if (next === 'peace') {
    return current === 'war'
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'Peace is made from a state of war.' };
  }
  if (next === 'nap') {
    return current === 'peace'
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'A non-aggression pact is offered from peace, one step below an alliance.' };
  }
  if (next === 'alliance') {
    return current === 'nap'
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'An alliance requires a non-aggression pact first.' };
  }
  return { ok: false, reason: 'Unknown stance.' };
}

export function canOfferTreaty(stance: Stance): { ok: boolean; reason: string } {
  if (stance === 'war') return { ok: false, reason: 'Treaties are not signed in wartime.' };
  return { ok: true, reason: '' };
}

export function applyWar(rel: Relation): Relation {
  return {
    ...rel,
    stance: 'war',
    research: false,
    exploration: false,
    memory: Math.min(100, rel.memory + CONFIG.diplomacy.warMemory),
  };
}

export function downgradeStance(stance: Stance): Stance {
  if (stance === 'alliance') return 'nap';
  if (stance === 'nap') return 'peace';
  if (stance === 'peace') return 'war';
  return 'war';
}

export function axisOverlap(a: SocialAxes, b: SocialAxes): number {
  let matches = 0;
  if (a.religion === b.religion) matches += 1;
  if (a.values === b.values) matches += 1;
  if (a.economy === b.economy) matches += 1;
  if (a.politics === b.politics) matches += 1;
  return matches;
}

export function acceptanceChance(opts: {
  kind: Proposal;
  diplomacy: string;
  aggression: string;
  memory: number;
  axisMatches: number;
}): number {
  let chance = CONFIG.diplomacy.accept[opts.kind] ?? 0.4;
  if (opts.diplomacy === 'treaty') chance += CONFIG.diplomacy.treatySeekerBonus;
  if (opts.diplomacy === 'trader' && (opts.kind === 'research' || opts.kind === 'exploration')) {
    chance += CONFIG.diplomacy.traderTreatyBonus;
  }
  if (opts.diplomacy === 'alone') chance -= CONFIG.diplomacy.alonePenalty;
  if (opts.aggression === 'very-aggressive' && (opts.kind === 'peace' || opts.kind === 'nap' || opts.kind === 'alliance')) {
    chance -= CONFIG.diplomacy.aggressionPenalty;
  }
  if (opts.aggression === 'easy') chance += CONFIG.diplomacy.aggressionPenalty * 0.5;
  chance += opts.axisMatches * CONFIG.diplomacy.axisMatchBonus;
  chance -= opts.memory * CONFIG.diplomacy.memoryPenaltyPerPoint;
  return Math.max(0.05, Math.min(0.95, chance));
}

export function blocksAttack(stance: Stance): boolean {
  return stance === 'nap' || stance === 'alliance';
}

export function sharesMaps(rel: Pick<Relation, 'exploration' | 'stance'>): boolean {
  return rel.exploration || rel.stance === 'alliance';
}

export function sharesResearch(rel: Pick<Relation, 'research' | 'stance'>): boolean {
  return rel.research && rel.stance !== 'war';
}

export function proposalLabel(kind: Proposal | 'war'): string {
  switch (kind) {
    case 'war':
      return 'war';
    case 'peace':
      return 'peace';
    case 'nap':
      return 'a non-aggression pact';
    case 'alliance':
      return 'an alliance';
    case 'research':
      return 'a research treaty';
    case 'exploration':
      return 'an exploration treaty';
    default:
      return kind;
  }
}
