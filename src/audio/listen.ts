import { cuesForLines, freshLogLines, isReactorHarm, terraformProgressDelays, type LogLine, type TerraformSnap } from './cues';
import { isCombatOrWar } from './music';
import type { GameSfx } from './sfx';

/** The slice of AudioBus these cues need. Mute and volume stay inside the bus. */
export interface CueSink {
  play(kind: 'pulse'): void;
  playCue(kind: GameSfx, delay?: number): void;
  /** Optional so older cue mocks keep working. Combat and war raise the tension track. */
  stirTension?(): void;
}

export interface WorkingUnit {
  id: number;
  factionId: string;
  terraform: { turnsLeft: number } | null;
}

export function snapshotLog<T>(log: readonly T[]): T[] {
  return log.slice();
}

export function snapshotTerraform(units: readonly WorkingUnit[], factionId: string): TerraformSnap[] {
  const snaps: TerraformSnap[] = [];
  for (const unit of units) {
    if (unit.factionId === factionId && unit.terraform) snaps.push({ id: unit.id, turnsLeft: unit.terraform.turnsLeft });
  }
  return snaps;
}

/**
 * Plays terraform completion and harsh-ground damage for the player.
 * Reactor harm keeps the pulse sting.
 */
export function playLoggedCues(audio: CueSink, before: readonly LogLine[], after: readonly LogLine[], playerFaction: string) {
  const fresh = freshLogLines(before, after);
  for (const hit of cuesForLines(fresh, playerFaction)) {
    const base = hit.kind === 'travel-damage' ? 0.12 : 0.04;
    audio.playCue(hit.kind, base + hit.delay);
  }
  for (const line of fresh) {
    if (isReactorHarm(line.text)) audio.play('pulse');
  }
  if (fresh.some((line) => isCombatOrWar(line.text))) audio.stirTension?.();
}

/** A short chug for each of the player's terraformers that advanced a week. */
export function playTerraformProgress(audio: CueSink, before: readonly TerraformSnap[], after: readonly TerraformSnap[]) {
  for (const delay of terraformProgressDelays(before, after)) audio.playCue('terraform-progress', delay);
}
