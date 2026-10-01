import { CONFIG } from '../config';

/** A roll below the catch chance means the spy is caught. There is no upkeep. */
export function missionCaught(roll: number, catchChance: number): boolean {
  return roll < catchChance;
}

export function spyMaintenancePerTurn(): number {
  return CONFIG.spies.maintenance;
}

export function frameBlame(caught: boolean): { betweenTargets: number; againstOwner: number } {
  if (caught) return { betweenTargets: 0, againstOwner: CONFIG.spies.caughtMemory };
  return { betweenTargets: CONFIG.spies.frameMemory, againstOwner: 0 };
}
