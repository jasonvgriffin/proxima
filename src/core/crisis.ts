import { CONFIG } from '../config';

/**
 * The Waking Reactor. After a quiet stretch of weeks the buried ark core
 * starts to pulse, and the livable band frays unless it is anchored.
 */
export function crisisLevel(round: number): number {
  if (round <= CONFIG.crisis.startRound) return 0;
  const t = (round - CONFIG.crisis.startRound) / CONFIG.crisis.rampRounds;
  return Math.max(0, Math.min(1, t));
}

export function crisisWarned(round: number): boolean {
  return round >= CONFIG.crisis.startRound;
}

export function crisisBandDamage(level: number): number {
  return Math.round(level * CONFIG.crisis.maxBandDamage);
}

export function crisisCreditTithe(level: number): number {
  return Math.round(level * CONFIG.crisis.creditTithe);
}

export function crisisYieldFactor(level: number): number {
  return 1 - level * CONFIG.crisis.maxYieldPenalty;
}

export function scarRollHits(roll: number, level: number): boolean {
  if (level <= 0) return false;
  return roll < CONFIG.crisis.scarChance * level;
}
