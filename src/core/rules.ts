import { CONFIG, type BiomeClass } from '../config';
import { aggressionAdjust } from './difficulty';
import { FACTIONS, socialOption } from './factions';
import { formerTechLevel } from './tech';
import type {
  FactionId,
  GameState,
  ImprovementId,
  SocialAxes,
  SocialStat,
  TerrainId,
  Tile,
  Winner,
} from './types';
import { shuffle } from './rng';

const SEA: ReadonlySet<TerrainId> = new Set(['hot-sea', 'temperate-sea', 'frozen-sea']);

export function isSea(terrain: TerrainId): boolean {
  return SEA.has(terrain);
}

export function zoneForColumn(x: number): 'day' | 'twilight' | 'night' {
  if (x < CONFIG.map.bandStart) return 'day';
  if (x > CONFIG.map.bandEnd) return 'night';
  return 'twilight';
}

export function biomeClass(tile: Pick<Tile, 'terrain' | 'zone'>): BiomeClass {
  if (tile.terrain === 'toxic') return 'toxic';
  if (tile.terrain === 'thin-air') return 'thin-air';
  if (
    tile.terrain === 'frozen-plain' ||
    tile.terrain === 'ice-ridge' ||
    tile.terrain === 'frozen-sea' ||
    tile.zone === 'night'
  ) {
    return 'frozen';
  }
  if (tile.zone === 'day') return 'scorched';
  return 'standard';
}

export function baseCityCreditIncome(population: number): number {
  return population * CONFIG.economy.creditsPerPopulation + CONFIG.economy.creditsFlatPerCity;
}

export function rushBuyCost(remainingPoints: number): number {
  if (remainingPoints <= 0) return 0;
  return Math.max(
    CONFIG.economy.rushMinimumCredits,
    remainingPoints * CONFIG.economy.rushCreditPerProductionPoint,
  );
}

export interface RushPayment {
  credits: number;
  minerals: number;
  nutrients: number;
  energy: number;
}

/** Credits plus the stockpile a rush spends. Zero when the build is already done. */
export function rushPayments(remainingPoints: number): RushPayment {
  if (remainingPoints <= 0) return { credits: 0, minerals: 0, nutrients: 0, energy: 0 };
  return {
    credits: rushBuyCost(remainingPoints),
    minerals: remainingPoints * CONFIG.economy.rushMineralsPerPoint,
    nutrients: remainingPoints * CONFIG.economy.rushNutrientsPerPoint,
    energy: remainingPoints * CONFIG.economy.rushEnergyPerPoint,
  };
}

export function terraformEnergy(project: string): number {
  return CONFIG.terraform.energyCost[project] ?? 0;
}

/** Only atmosphere work pulls a tile into the livable zone. Roads, farms, and mines do not. */
export function projectMakesLivable(project: ImprovementId): boolean {
  return project === 'atmosphere';
}

export function unitUpkeep(role: string): number {
  return CONFIG.upkeep[role as keyof typeof CONFIG.upkeep] ?? 0;
}

/** A faction is out when it has no city and nothing that can found one. */
export function factionEliminated(cityCount: number, units: readonly { canFound: boolean }[]): boolean {
  if (cityCount > 0) return false;
  return !units.some((unit) => unit.canFound);
}

export function terraformFee(biome: BiomeClass): number {
  const mult = CONFIG.terraform.biomeFee[biome] ?? 1;
  return Math.round(CONFIG.terraform.baseFee * mult);
}

export function terraformTurns(project: string, techLevel: number): number {
  const base = CONFIG.terraform.baseTurns[project];
  if (!base) return 1;
  const pct =
    CONFIG.terraform.techSpeedPercent[techLevel] ??
    CONFIG.terraform.techSpeedPercent[1];
  return Math.max(1, Math.floor((base * pct + 99) / 100));
}

export interface Combatant {
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
}

/** Attacker victory chance in the range 0..1. */
export function combatOdds(attacker: Combatant, defender: Combatant, terrainMod: number): number {
  const a = attacker.attack * (attacker.hp / Math.max(1, attacker.maxHp));
  const mod = Math.max(-0.6, terrainMod);
  const d = defender.defense * (1 + mod) * (defender.hp / Math.max(1, defender.maxHp));
  if (a <= 0) return 0;
  if (d <= 0) return 1;
  return a / (a + d);
}

export function attackerWins(odds: number, roll: number): boolean {
  return roll < odds;
}

export function winnerHpLoss(maxHp: number, odds: number): number {
  return Math.max(1, Math.round(maxHp * (1 - odds) * CONFIG.combat.winnerDamageFactor));
}

export function terrainDefenseMod(terrain: TerrainId, inCity: boolean): number {
  const base = CONFIG.combat.terrainMod[terrain] ?? 0;
  return base + (inCity ? CONFIG.city.cityDefenseBonus : 0);
}

export function outsideBandOutcome(
  hp: number,
  livable: boolean,
  hasSealed: boolean,
  damage: number = CONFIG.outsideBand.damagePerTurn,
): { hp: number; destroyed: boolean } {
  if (livable || hasSealed) return { hp, destroyed: false };
  const next = hp - damage;
  return { hp: next, destroyed: next <= 0 };
}

export function calendarForRound(round: number): { year: number; week: number } {
  const index = Math.max(0, round - 1);
  return {
    year: CONFIG.calendar.startYear + Math.floor(index / CONFIG.calendar.weeksPerYear),
    week: (index % CONFIG.calendar.weeksPerYear) + 1,
  };
}

export function formatCalendar(round: number): string {
  const { year, week } = calendarForRound(round);
  return `Year ${year}, Week ${week}`;
}

/** Player first, then the other factions in a freshly shuffled order. */
export function planRoundOrder(player: FactionId, others: readonly FactionId[], rnd: () => number): FactionId[] {
  return [player, ...shuffle(others, rnd)];
}

export function shouldAutosave(playerTurnsCompleted: number, enabled: boolean): boolean {
  return enabled && playerTurnsCompleted > 0 && playerTurnsCompleted % CONFIG.autosaveEveryTurns === 0;
}

export function peaceWindow(aggression: string, difficulty: string): number {
  const base = CONFIG.peace.byAggression[aggression] ?? CONFIG.peace.byAggression.normal;
  return Math.max(CONFIG.peace.minimum, base + aggressionAdjust(difficulty));
}

export function statMultiplier(faction: FactionId, axes: SocialAxes, stat: SocialStat): number {
  let matches = 0;
  (Object.keys(axes) as (keyof SocialAxes)[]).forEach((axis) => {
    const opt = socialOption(axis, axes[axis]);
    if (opt && opt.stat === stat && FACTIONS[faction].matches.includes(opt.id)) matches += 1;
  });
  return 1 + matches * CONFIG.social.matchingBonus;
}

export function stabilityMultiplier(stabilityTurns: number): number {
  if (stabilityTurns <= 0) return 1;
  return 1 - CONFIG.social.stabilityYieldPenalty;
}

export interface FoundingCheck {
  ok: boolean;
  reason: string;
}

export function canFoundCity(opts: {
  canFound: boolean;
  sea: boolean;
  livable: boolean;
  inBand: boolean;
  hasSealed: boolean;
  nearestCity: number;
  cityHere: boolean;
}): FoundingCheck {
  if (!opts.canFound) return { ok: false, reason: 'Only a colony pod can found a city.' };
  if (opts.sea) return { ok: false, reason: 'Cities cannot be founded on water.' };
  if (opts.cityHere) return { ok: false, reason: 'There is already a city here.' };
  if (opts.nearestCity < CONFIG.city.minDistance) {
    return { ok: false, reason: `Too close to another city (need ${CONFIG.city.minDistance} tiles).` };
  }
  const allowed = opts.inBand || opts.livable || opts.hasSealed;
  if (!allowed) {
    return {
      ok: false,
      reason: 'Cities can only be founded in the twilight band, on terraformed livable ground, or after Sealed Habitats / Geothermal Wells.',
    };
  }
  return { ok: true, reason: '' };
}

export function hasSealedHabitats(techs: readonly string[]): boolean {
  return techs.includes('sealed-habitats');
}

export function tileIsLivable(tile: Pick<Tile, 'zone' | 'livable' | 'scarred'>): boolean {
  if (tile.scarred) return false;
  return tile.zone === 'twilight' || tile.livable;
}

export function improvementYield(project: ImprovementId): {
  minerals: number;
  nutrients: number;
  energy: number;
  research: number;
} {
  switch (project) {
    case 'plant-trees':
      return { minerals: 0, nutrients: 2, energy: 0, research: 0 };
    case 'farm':
      return { minerals: 0, nutrients: 2, energy: 0, research: 0 };
    case 'mine':
      return { minerals: 3, nutrients: 0, energy: 0, research: 0 };
    case 'solar':
      return { minerals: 0, nutrients: 0, energy: 2, research: 0 };
    case 'road':
      return { minerals: 0, nutrients: 0, energy: 0, research: 0 };
    case 'atmosphere':
      return { minerals: 1, nutrients: 1, energy: 1, research: 0 };
    default:
      return { minerals: 0, nutrients: 0, energy: 0, research: 0 };
  }
}

export function evaluateVictory(
  cityOwners: readonly FactionId[],
  alliances: readonly [FactionId, FactionId][],
  alliedVictory: boolean,
  stillFounding: readonly FactionId[] = [],
): Winner | null {
  const owners = [...new Set(cityOwners)];
  if (owners.length === 0) return null;
  const contenders = new Set<FactionId>([...owners, ...stillFounding]);
  if (owners.length === 1 && contenders.size === 1) return { kind: 'solo', factions: [owners[0]] };
  if (owners.length === 1) return null;
  if (!alliedVictory || alliances.length === 0) return null;
  const parent = new Map<FactionId, FactionId>();
  const find = (id: FactionId): FactionId => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: FactionId, b: FactionId) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const [a, b] of alliances) union(a, b);
  const root = find(owners[0]);
  if ([...contenders].every((id) => find(id) === root)) {
    const members = new Set<FactionId>([root]);
    for (const [a, b] of alliances) {
      if (find(a) === root) {
        members.add(a);
        members.add(b);
      }
    }
    if (members.size > 1) return { kind: 'alliance', factions: [...members] };
  }
  return null;
}

export function formerLevelFromTechs(techs: readonly string[]): number {
  return formerTechLevel(techs);
}

export function projectAllowed(project: ImprovementId, techs: readonly string[]): boolean {
  if (project === 'atmosphere') return techs.includes('atmosphere');
  return true;
}

/** Odds the AI needs before it will start a fight. */
export function attackThreshold(risk: string): number {
  return CONFIG.ai.oddsThreshold[risk] ?? CONFIG.ai.oddsThreshold.measured;
}

export function emptyExplored(width: number, height: number): boolean[] {
  return Array.from({ length: width * height }, () => false);
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
