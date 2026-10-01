import { techById, TECHS, type TechDef } from './tech';
import type { TechOrigin } from './types';

/** Ordered unresearched technologies from prerequisites up to the goal. */
export function pathToGoal(goalId: string, known: readonly string[]): string[] | null {
  const goal = techById(goalId);
  if (!goal) return null;
  const knownSet = new Set(known);
  const needed = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string): boolean => {
    if (knownSet.has(id) || needed.has(id)) return true;
    if (visiting.has(id)) return false;
    const tech = techById(id);
    if (!tech) return false;
    visiting.add(id);
    for (const req of tech.requires) {
      if (!visit(req)) return false;
    }
    visiting.delete(id);
    needed.add(id);
    return true;
  };

  if (!visit(goalId)) return null;

  const ordered: string[] = [];
  const placed = new Set(known);
  const remaining = new Set(needed);
  let guard = 0;
  while (remaining.size > 0 && guard++ < TECHS.length + 2) {
    const ready = [...remaining].filter((id) => {
      const tech = techById(id);
      return !!tech && tech.requires.every((req) => placed.has(req));
    });
    if (!ready.length) return null;
    ready.sort((a, b) => {
      const cost = (techById(a)?.cost ?? 0) - (techById(b)?.cost ?? 0);
      return cost || a.localeCompare(b);
    });
    const pick = ready[0];
    ordered.push(pick);
    placed.add(pick);
    remaining.delete(pick);
  }
  return remaining.size ? null : ordered;
}

/** First queued technology whose prerequisites are already known. */
export function nextQueuedResearch(queue: readonly string[] | undefined, known: readonly string[]): string | null {
  if (!queue) return null;
  const have = new Set(known);
  for (const id of queue) {
    if (have.has(id)) continue;
    const tech = techById(id);
    if (tech && tech.requires.every((req) => have.has(req))) return id;
  }
  return null;
}

/**
 * Drop known steps. Clear the goal once it is known.
 * Returns the next technology to study, if one is ready.
 */
export function advanceResearchQueue(faction: {
  techs: readonly string[];
  researchGoal: string | null;
  researchQueue: string[];
}): string | null {
  const known = new Set(faction.techs);
  faction.researchQueue = faction.researchQueue.filter((id) => !known.has(id));
  if (faction.researchGoal && known.has(faction.researchGoal)) {
    faction.researchGoal = null;
    faction.researchQueue = [];
    return null;
  }
  return nextQueuedResearch(faction.researchQueue, faction.techs);
}

export function ancestorIds(id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (current: string) => {
    const tech = techById(current);
    if (!tech) return;
    for (const req of tech.requires) {
      if (seen.has(req)) continue;
      seen.add(req);
      out.push(req);
      walk(req);
    }
  };
  walk(id);
  return out;
}

export function descendantIds(id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (current: string) => {
    for (const tech of TECHS) {
      if (!tech.requires.includes(current) || seen.has(tech.id)) continue;
      seen.add(tech.id);
      out.push(tech.id);
      walk(tech.id);
    }
  };
  walk(id);
  return out;
}

/** Prerequisites still missing anywhere above this technology. */
export function unmetPrereqs(id: string, known: readonly string[]): string[] {
  const have = new Set(known);
  return ancestorIds(id).filter((req) => !have.has(req));
}

export function directChildren(id: string): TechDef[] {
  return TECHS.filter((tech) => tech.requires.includes(id));
}

/**
 * Cross-faction technologies a research treaty can copy:
 * a partner already knows it, and every prerequisite is known here.
 */
export function treatyTechGrants(known: readonly string[], partners: readonly (readonly string[])[]): string[] {
  const have = new Set(known);
  const granted: string[] = [];
  let guard = 0;
  let changed = true;
  while (changed && guard++ <= TECHS.length) {
    changed = false;
    for (const tech of TECHS) {
      if (!tech.crossFaction || have.has(tech.id)) continue;
      if (!tech.requires.every((req) => have.has(req))) continue;
      if (!partners.some((list) => list.includes(tech.id))) continue;
      have.add(tech.id);
      granted.push(tech.id);
      changed = true;
    }
  }
  return granted;
}

export function rememberTech(origins: Record<string, TechOrigin>, id: string, origin: TechOrigin): void {
  if (!origins[id]) origins[id] = origin;
}

export function ensureFactionResearch(
  faction: {
    techs: readonly string[];
    researchGoal?: string | null;
    researchQueue?: string[];
    techOrigins?: Record<string, TechOrigin>;
  },
  opts?: { fillMissing?: boolean },
): void {
  if (!faction.techOrigins) faction.techOrigins = {};
  if (!Array.isArray(faction.researchQueue)) faction.researchQueue = [];
  if (faction.researchGoal == null) faction.researchGoal = null;
  if (!opts?.fillMissing) return;
  for (const id of faction.techs) {
    if (!faction.techOrigins[id]) faction.techOrigins[id] = 'start';
  }
}

/** Turns to pay `cost` at `ratePerTurn`, counting points already banked. Null when income is zero. */
export function turnsToFinish(cost: number, banked: number, ratePerTurn: number): number | null {
  const remaining = Math.max(0, cost - Math.max(0, banked));
  if (remaining === 0) return 0;
  if (ratePerTurn <= 0) return null;
  return Math.ceil(remaining / ratePerTurn);
}
