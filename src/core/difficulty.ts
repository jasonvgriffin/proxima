import { CONFIG } from '../config';
import type { Difficulty } from './types';

/**
 * The only difficulty tuning table.
 *
 * Easy, Normal, Hard, and Brutal change rival production, research, and
 * credits, how soon rivals attack, starting stockpiles, damage on
 * hostile ground, and when and how hard the Waking Reactor hits.
 * Normal matches the baseline numbers in CONFIG. Other levels are offsets
 * from that baseline, written out here so they can be edited in one place.
 */
export interface DifficultyProfile {
  id: Difficulty;
  label: string;
  blurb: string;
  /** AI mineral yield. Minerals fill the city production queue. */
  production: number;
  /** AI research yield. */
  research: number;
  /** AI credit income. */
  credits: number;
  /** Added to every rival's peace window. Positive means they wait longer. */
  aggressionAdjust: number;
  /** Multiplier on the human stockpile at the start of a game. */
  playerStarting: number;
  /** Multiplier on each AI stockpile at the start of a game. */
  aiStarting: number;
  /** Damage a unit takes each of its turns on hostile ground. */
  exposureDamage: number;
  /** Week the Waking Reactor begins. */
  crisisStartRound: number;
  /** Scales crisis damage, the credit tithe, yield loss, and scarring. */
  crisisStrength: number;
}

const exposureBase = CONFIG.exposure.damagePerTurn;
const crisisStart = CONFIG.crisis.startRound;

export const DIFFICULTY_TABLE: Record<Difficulty, DifficultyProfile> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    blurb: 'Rivals produce, research, and earn less, and they wait longer to attack. You start richer. Harsh ground and the reactor are gentler.',
    production: 0.7,
    research: 0.7,
    credits: 0.75,
    aggressionAdjust: 6,
    playerStarting: 1.4,
    aiStarting: 0.7,
    exposureDamage: Math.max(1, exposureBase - 2),
    crisisStartRound: crisisStart + 12,
    crisisStrength: 0.65,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    blurb: 'The baseline. Rival yards, the peace window, harsh ground, and the Waking Reactor use the standard numbers.',
    production: 1,
    research: 1,
    credits: 1,
    aggressionAdjust: 0,
    playerStarting: 1,
    aiStarting: 1,
    exposureDamage: exposureBase,
    crisisStartRound: crisisStart,
    crisisStrength: 1,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    blurb: 'Rivals run hotter yards, attack sooner, and start with more supplies. Harsh ground bites harder, and the reactor comes early.',
    production: 1.3,
    research: 1.3,
    credits: 1.35,
    aggressionAdjust: -4,
    playerStarting: 0.75,
    aiStarting: 1.35,
    exposureDamage: exposureBase + 2,
    crisisStartRound: Math.max(8, crisisStart - 8),
    crisisStrength: 1.3,
  },
  brutal: {
    id: 'brutal',
    label: 'Brutal',
    blurb: 'Rival production, research, and credits surge. They close in fast, harsh ground punishes travel, and the reactor hits early and hard.',
    production: 1.65,
    research: 1.6,
    credits: 1.7,
    aggressionAdjust: -8,
    playerStarting: 0.5,
    aiStarting: 1.75,
    exposureDamage: exposureBase + 5,
    crisisStartRound: Math.max(8, crisisStart - 16),
    crisisStrength: 1.65,
  },
};

export const DIFFICULTIES: readonly DifficultyProfile[] = [
  DIFFICULTY_TABLE.easy,
  DIFFICULTY_TABLE.normal,
  DIFFICULTY_TABLE.hard,
  DIFFICULTY_TABLE.brutal,
];

const KNOWN: ReadonlySet<string> = new Set(DIFFICULTIES.map((profile) => profile.id));

/** Saves from before these four levels, and any unknown value, play as Normal. */
export function normalizeDifficulty(value: unknown): Difficulty {
  if (typeof value === 'string' && KNOWN.has(value)) return value as Difficulty;
  return 'normal';
}

export function difficultyProfile(value: unknown): DifficultyProfile {
  return DIFFICULTY_TABLE[normalizeDifficulty(value)];
}

export function difficultyLabel(value: unknown): string {
  return difficultyProfile(value).label;
}

export interface EconomyRates {
  production: number;
  research: number;
  credits: number;
}

/** Human cities stay at 1. Rival cities use the difficulty table. */
export function economyRates(isHuman: boolean, difficulty: unknown): EconomyRates {
  if (isHuman) return { production: 1, research: 1, credits: 1 };
  const profile = difficultyProfile(difficulty);
  return {
    production: profile.production,
    research: profile.research,
    credits: profile.credits,
  };
}

export function aggressionAdjust(difficulty: unknown): number {
  return difficultyProfile(difficulty).aggressionAdjust;
}

export function startingMultiplier(isHuman: boolean, difficulty: unknown): number {
  const profile = difficultyProfile(difficulty);
  return isHuman ? profile.playerStarting : profile.aiStarting;
}

export function scaleStarting(amount: number, isHuman: boolean, difficulty: unknown): number {
  return Math.round(amount * startingMultiplier(isHuman, difficulty));
}

export function exposureDamage(difficulty: unknown): number {
  return difficultyProfile(difficulty).exposureDamage;
}

export interface CrisisTuning {
  startRound: number;
  level: number;
  damage: number;
  tithe: number;
  yieldFactor: number;
  scarChance: number;
}

/**
 * Same ramp shape as the baseline crisis, shifted and scaled by difficulty.
 * Level is 0 on the warning week and reaches 1 after the usual ramp.
 */
export function crisisTuning(round: number, difficulty: unknown): CrisisTuning {
  const profile = difficultyProfile(difficulty);
  const start = profile.crisisStartRound;
  const ramp = CONFIG.crisis.rampRounds;
  const level = round <= start ? 0 : Math.max(0, Math.min(1, (round - start) / ramp));
  const strength = profile.crisisStrength;
  return {
    startRound: start,
    level,
    damage: Math.round(level * CONFIG.crisis.maxPulseDamage * strength),
    tithe: Math.round(level * CONFIG.crisis.creditTithe * strength),
    yieldFactor: Math.max(0, 1 - level * CONFIG.crisis.maxYieldPenalty * strength),
    scarChance: CONFIG.crisis.scarChance * level * strength,
  };
}
