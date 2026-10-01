import { CONFIG } from '../config';
import { FACTIONS, factionMatches, socialOption } from './factions';
import {
  FACTION_IDS,
  type AxisMark,
  type FactionId,
  type GameState,
  type SocialAxes,
  type SocialAxis,
  type SocialStat,
} from './types';

export const SOCIAL_AXES: SocialAxis[] = ['religion', 'values', 'economy', 'politics'];

/** Closing stance for one week of the human player's run. */
export interface AxisTurn {
  round: number;
  axes: SocialAxes;
}

/** One successful change of a single social axis. */
export interface AxisSwitch {
  round: number;
  axis: SocialAxis;
  from: string;
  to: string;
}

/**
 * Per-turn social record for the end-of-run recap.
 * Saves written before this field existed omit it; {@link recordSocialPresent} rebuilds it.
 */
export interface AxisDrift {
  turns: AxisTurn[];
  switches: AxisSwitch[];
}

export interface MatchingChoice {
  axis: SocialAxis;
  id: string;
  label: string;
  stat: SocialStat;
}

export interface DriftSummary {
  finalAxes: SocialAxes;
  finalLabels: Record<SocialAxis, string>;
  switchCount: number;
  switches: AxisSwitch[];
  finalMatchCount: number;
  /** Fraction added on top of the base yield, such as 0.2 for +20%. */
  finalBonus: number;
  matchedLabels: string[];
  /** Sum of each week's matching bonus. 0.1 per matching choice per week. */
  bonusWeeks: number;
  /** How many choice-weeks the +10% bonus was active. */
  choiceWeeks: number;
  weeks: number;
}

export interface SocietyCompare {
  id: FactionId;
  name: string;
  color: string;
  shared: number;
  axes: { axis: SocialAxis; playerLabel: string; otherLabel: string; same: boolean }[];
}

export function copyAxes(axes: SocialAxes): SocialAxes {
  return {
    religion: axes.religion,
    values: axes.values,
    economy: axes.economy,
    politics: axes.politics,
  };
}

export function socialLabel(axis: SocialAxis, id: string): string {
  return socialOption(axis, id)?.label ?? id;
}

export function seedAxisDrift(round: number, axes: SocialAxes): AxisDrift {
  return { turns: [{ round, axes: copyAxes(axes) }], switches: [] };
}

export function matchingChoices(factionId: FactionId, axes: SocialAxes): MatchingChoice[] {
  const found: MatchingChoice[] = [];
  for (const axis of SOCIAL_AXES) {
    const opt = socialOption(axis, axes[axis]);
    if (opt && factionMatches(factionId, opt.id)) {
      found.push({ axis, id: opt.id, label: opt.label, stat: opt.stat });
    }
  }
  return found;
}

export function summarizeDrift(drift: AxisDrift, factionId: FactionId): DriftSummary {
  const turns = drift.turns;
  const finalAxes = copyAxes(
    turns[turns.length - 1]?.axes ?? { religion: '', values: '', economy: '', politics: '' },
  );
  const matched = matchingChoices(factionId, finalAxes);
  let choiceWeeks = 0;
  for (const turn of turns) choiceWeeks += matchingChoices(factionId, turn.axes).length;
  const finalLabels = {} as Record<SocialAxis, string>;
  for (const axis of SOCIAL_AXES) finalLabels[axis] = socialLabel(axis, finalAxes[axis]);
  return {
    finalAxes,
    finalLabels,
    switchCount: drift.switches.length,
    switches: drift.switches.map((entry) => ({ ...entry })),
    finalMatchCount: matched.length,
    finalBonus: matched.length * CONFIG.social.matchingBonus,
    matchedLabels: matched.map((choice) => choice.label),
    bonusWeeks: choiceWeeks * CONFIG.social.matchingBonus,
    choiceWeeks,
    weeks: turns.length,
  };
}

export function compareSocieties(
  playerId: FactionId,
  playerAxes: SocialAxes,
  factions: Record<FactionId, { axes: SocialAxes }>,
): SocietyCompare[] {
  return FACTION_IDS.filter((id) => id !== playerId)
    .map((id) => {
      const other = factions[id].axes;
      const axes = SOCIAL_AXES.map((axis) => ({
        axis,
        playerLabel: socialLabel(axis, playerAxes[axis]),
        otherLabel: socialLabel(axis, other[axis]),
        same: playerAxes[axis] === other[axis],
      }));
      return {
        id,
        name: FACTIONS[id].name,
        color: FACTIONS[id].colors.main,
        shared: axes.filter((axis) => axis.same).length,
        axes,
      };
    })
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));
}

function isDrift(value: AxisDrift | undefined): value is AxisDrift {
  return !!value && Array.isArray(value.turns) && Array.isArray(value.switches);
}

function marksOf(state: GameState): AxisMark[] {
  const raw = state.axisHistory as AxisMark[] | undefined;
  if (!Array.isArray(raw)) return [];
  return raw.filter((mark) => mark && mark.axes && typeof mark.round === 'number');
}

/**
 * Make sure the per-turn record exists and matches the current week.
 * Old saves have no `axisDrift`; the switch log in `axisHistory` is enough to rebuild one.
 */
export function recordSocialPresent(state: GameState): AxisDrift {
  const live = copyAxes(state.factions[state.playerFaction].axes);
  const through = Math.max(1, state.round || 1);
  if (!isDrift(state.axisDrift)) state.axisDrift = { turns: [], switches: [] };
  applyMarks(state.axisDrift, marksOf(state), through, live);
  return state.axisDrift;
}

function switchesFrom(ordered: AxisMark[]): AxisSwitch[] {
  const switches: AxisSwitch[] = [];
  if (ordered.length < 2) return switches;
  let prev = copyAxes(ordered[0].axes);
  for (let i = 1; i < ordered.length; i++) {
    const next = ordered[i].axes;
    for (const axis of SOCIAL_AXES) {
      if (prev[axis] !== next[axis]) {
        switches.push({ round: ordered[i].round, axis, from: prev[axis], to: next[axis] });
      }
    }
    prev = copyAxes(next);
  }
  return switches;
}

function applyMarks(drift: AxisDrift, marks: AxisMark[], throughRound: number, live: SocialAxes): void {
  const ordered = [...marks].sort((a, b) => a.round - b.round);
  drift.switches = switchesFrom(ordered);

  const anchors = new Map<number, SocialAxes>();
  if (ordered.length > 0) {
    for (const mark of ordered) anchors.set(mark.round, copyAxes(mark.axes));
  } else if (drift.turns.length > 0) {
    for (const turn of drift.turns) anchors.set(turn.round, copyAxes(turn.axes));
  } else {
    for (let round = 1; round <= throughRound; round++) anchors.set(round, copyAxes(live));
  }

  const start = Math.min(...anchors.keys());
  const end = Math.max(throughRound, ...anchors.keys());
  let carry = copyAxes(anchors.get(start) ?? live);
  const turns: AxisTurn[] = [];
  for (let round = start; round <= end; round++) {
    if (anchors.has(round)) carry = copyAxes(anchors.get(round)!);
    turns.push({ round, axes: copyAxes(carry) });
  }

  const historyOwns = ordered.slice(1).some((mark) => mark.round === throughRound);
  const current = turns.find((turn) => turn.round === throughRound);
  if (current && !historyOwns) current.axes = copyAxes(live);
  drift.turns = turns;
}
