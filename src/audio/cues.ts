/**
 * Decides which terraforming and travel-damage cues to play from the log
 * and from terraformer state. Pure: no audio, so the game loop can test it.
 *
 * Travel damage and terraform completion are the player's own events.
 * Rival crews stay quiet so a full AI round does not stack hisses.
 */

export interface LogLine {
  text: string;
  factionId?: string;
}

export interface TerraformSnap {
  id: number;
  turnsLeft: number;
}

export type CueKind = 'terraform-progress' | 'terraform-complete' | 'travel-damage';

export interface CueHit {
  kind: CueKind;
  delay: number;
}

const TRAVEL_DAMAGE = /takes \d+ damage from the harsh ground/;
const TRAVEL_LOST = /is destroyed by the harsh ground/;
const TERRAFORM_DONE = /finishes /;

const TRAVEL_GAP = 0.11;
const DONE_GAP = 0.06;
const PROGRESS_GAP = 0.16;
const MAX_TRAVEL = 3;
const MAX_DONE = 2;
const MAX_PROGRESS = 2;

/** Log entries pushed after `before` was copied, even if the cap trimmed the front. */
export function freshLogLines<T extends object>(before: readonly T[], after: readonly T[]): T[] {
  const seen = new Set<T>(before);
  return after.filter((line) => !seen.has(line));
}

export function cuesForLines(lines: readonly LogLine[], playerFaction: string): CueHit[] {
  const hits: CueHit[] = [];
  let travel = 0;
  let done = 0;
  for (const line of lines) {
    if (line.factionId !== playerFaction) continue;
    if (TRAVEL_DAMAGE.test(line.text) || TRAVEL_LOST.test(line.text)) {
      if (travel < MAX_TRAVEL) hits.push({ kind: 'travel-damage', delay: travel * TRAVEL_GAP });
      travel += 1;
    } else if (TERRAFORM_DONE.test(line.text)) {
      if (done < MAX_DONE) hits.push({ kind: 'terraform-complete', delay: done * DONE_GAP });
      done += 1;
    }
  }
  return hits;
}

/**
 * Formers whose job ticked down but did not finish.
 * Completion is a log cue, so a job that reaches zero is not also a progress tick.
 */
export function terraformProgressDelays(before: readonly TerraformSnap[], after: readonly TerraformSnap[]): number[] {
  const next = new Map(after.map((snap) => [snap.id, snap.turnsLeft]));
  const delays: number[] = [];
  for (const snap of before) {
    const left = next.get(snap.id);
    if (left == null || left >= snap.turnsLeft || left <= 0) continue;
    if (delays.length < MAX_PROGRESS) delays.push(delays.length * PROGRESS_GAP);
  }
  return delays;
}

export function isReactorHarm(text: string): boolean {
  return text.includes('reactor pulse') || (text.includes('Waking Reactor') && text.includes('lost'));
}
