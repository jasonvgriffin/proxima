import { aggressionAdjust } from './difficulty';
import { FACTIONS } from './factions';
import type { FactionId, Personality } from './types';

/**
 * Shipped AI numbers, one row per faction. These are the 0.3.0 values.
 * A later balance change is an edit to that faction's row. The sim harness reads this table.
 * Game Options can still override a trait; see `TRAIT_AI` below, which only applies to a trait the player changed.
 *
 * Peace windows are added to the difficulty table's `aggressionAdjust` (Easy +6, Normal 0, Hard −4, Brutal −8).
 * City goals are added to `AI_RULES.cityTargetByDifficulty`. Attack odds are added to `AI_RULES.oddsByDifficulty` and the row's `oddsBias`.
 */

export type ResearchPlan = 'capstone' | 'practical' | 'mixed';

export interface FactionAi {
  /** Cities to found before this faction stops asking for colony pods, before the difficulty adjustment. */
  cityTarget: number;
  /** Colony pods kept in the field. Also capped by how many legal sites remain. */
  podCap: number;
  /** Quiet rounds before this faction will attack, before the difficulty adjustment. */
  peaceWindow: number;
  /** Extra rounds after the peace window on Easy. Hard and Brutal ignore both delays. */
  fightDelayEasy: number;
  /** Extra rounds after the peace window on Normal. */
  fightDelayNormal: number;
  /** Base chance of victory this faction wants before it attacks. Higher waits for a safer fight. */
  oddsThreshold: number;
  /** Added to the odds threshold. Positive means this faction waits for a safer fight. */
  oddsBias: number;
  /** Armies wanted beyond one per city and the difficulty's militaryExtra. */
  militaryBonus: number;
  /** Subtracted from the attack bar when this faction is behind and `catchUp` is set. */
  behindOddsCut: number;
  /** Subtracted after round 80 when this faction is ahead, or tied and `pressesLead`. */
  leadOddsCut: number;
  /** Build extra troops when behind in cities and already willing to fight. */
  catchUp: boolean;
  /**
   * While at war, hold this many soldiers above the city count before the next colony pod.
   * 0 does not hold production for a spare garrison. 0.3.0 used 0.
   */
  defendSpare: number;
  /** How this faction walks the tech tree. */
  research: ResearchPlan;
  /** Insert Soil Knit into the shared economy list. */
  studySoilKnit: boolean;
  /** Add Coil Weapons at the end of the shared economy list. Easy aggression leaves it off. */
  studyCoil: boolean;
  /** Terraformers to keep: one per city, or one per two cities. */
  formers: 'each-city' | 'half';
  /** Stop after the first terraformer instead of filling the former target. */
  fewFormers: boolean;
  /** Offer an exploration pact to a faction this one has met and is not fighting. */
  offersExploration: boolean;
  /** Climb peace, then a non-aggression pact, then an alliance. */
  seeksTreaties: boolean;
  /** Offer a research pact. */
  seeksResearch: boolean;
  /** Offer an alliance from a non-aggression pact. */
  offersAlliance: boolean;
  /** Once willing to fight, look for a war instead of waiting to be attacked. Hard and Brutal do this anyway. */
  opensWars: boolean;
  /** Break a non-aggression pact or an alliance in order to attack. The endgame can force this. */
  breaksPacts: boolean;
  /** Prefer a city assault when ranking attacks. */
  boldAttacks: boolean;
  /** After round 80, press an even lead instead of sitting on it. */
  pressesLead: boolean;
}

/** Shared shifts. These are not faction personality; every row is added to them. */
export const AI_RULES = {
  peaceMinimum: 4,
  oddsFloor: 0.28,
  oddsCeil: 0.82,
  /** City attacks never demand a higher chance than this. */
  cityOddsCap: 0.45,
  /** Two empires past this round march and attack at endgameOdds. */
  endgameRound: 200,
  endgameOdds: 0.05,
  /** Three or more empires past this round focus the smallest rival. */
  lateWarRound: 250,
  lateWarOdds: 0.1,
  cityTargetByDifficulty: { easy: -1, normal: 0, hard: 1, brutal: 2 } as Record<string, number>,
  oddsByDifficulty: { easy: 0.04, normal: 0, hard: -0.06, brutal: -0.12 } as Record<string, number>,
  militaryExtra: { easy: 3, normal: 4, hard: 6, brutal: 8 } as Record<string, number>,
};

export const FACTION_AI: Record<FactionId, FactionAi> = {
  helm: {
    cityTarget: 3,
    podCap: 1,
    peaceWindow: 12,
    fightDelayEasy: 10,
    fightDelayNormal: 0,
    oddsThreshold: 0.48,
    oddsBias: 0,
    militaryBonus: 1,
    behindOddsCut: 0.14,
    leadOddsCut: 0.04,
    catchUp: true,
    defendSpare: 0,
    research: 'practical',
    studySoilKnit: true,
    studyCoil: true,
    formers: 'half',
    fewFormers: false,
    offersExploration: true,
    seeksTreaties: true,
    seeksResearch: false,
    offersAlliance: false,
    opensWars: false,
    breaksPacts: true,
    boldAttacks: false,
    pressesLead: false,
  },
  verdantia: {
    cityTarget: 2,
    podCap: 1,
    peaceWindow: 16,
    fightDelayEasy: 18,
    fightDelayNormal: 14,
    oddsThreshold: 0.62,
    oddsBias: 0.08,
    militaryBonus: 0,
    behindOddsCut: 0,
    leadOddsCut: 0.04,
    catchUp: false,
    defendSpare: 0,
    research: 'capstone',
    studySoilKnit: true,
    studyCoil: false,
    formers: 'each-city',
    fewFormers: false,
    offersExploration: true,
    seeksTreaties: false,
    seeksResearch: true,
    offersAlliance: false,
    opensWars: false,
    breaksPacts: false,
    boldAttacks: false,
    pressesLead: false,
  },
  genesis: {
    cityTarget: 2,
    podCap: 1,
    peaceWindow: 16,
    fightDelayEasy: 18,
    fightDelayNormal: 14,
    oddsThreshold: 0.62,
    oddsBias: 0.08,
    militaryBonus: 0,
    behindOddsCut: 0,
    leadOddsCut: 0.04,
    catchUp: false,
    defendSpare: 0,
    research: 'capstone',
    studySoilKnit: true,
    studyCoil: false,
    formers: 'each-city',
    fewFormers: false,
    offersExploration: true,
    seeksTreaties: true,
    seeksResearch: false,
    offersAlliance: true,
    opensWars: false,
    breaksPacts: false,
    boldAttacks: false,
    pressesLead: false,
  },
  ironclad: {
    cityTarget: 5,
    podCap: 1,
    peaceWindow: 8,
    fightDelayEasy: 0,
    fightDelayNormal: 0,
    oddsThreshold: 0.3,
    oddsBias: 0,
    militaryBonus: 2,
    behindOddsCut: 0.14,
    leadOddsCut: 0.12,
    catchUp: true,
    defendSpare: 0,
    research: 'capstone',
    studySoilKnit: false,
    studyCoil: true,
    formers: 'half',
    fewFormers: true,
    offersExploration: false,
    seeksTreaties: false,
    seeksResearch: false,
    offersAlliance: false,
    opensWars: true,
    breaksPacts: true,
    boldAttacks: true,
    pressesLead: true,
  },
  mnemosyne: {
    cityTarget: 3,
    podCap: 1,
    peaceWindow: 12,
    fightDelayEasy: 10,
    fightDelayNormal: 0,
    oddsThreshold: 0.48,
    oddsBias: 0,
    militaryBonus: 1,
    behindOddsCut: 0.14,
    leadOddsCut: 0.04,
    catchUp: true,
    defendSpare: 0,
    research: 'capstone',
    studySoilKnit: true,
    studyCoil: true,
    formers: 'half',
    fewFormers: false,
    offersExploration: true,
    seeksTreaties: false,
    seeksResearch: true,
    offersAlliance: false,
    opensWars: false,
    breaksPacts: true,
    boldAttacks: false,
    pressesLead: false,
  },
  clio: {
    cityTarget: 3,
    podCap: 1,
    peaceWindow: 12,
    fightDelayEasy: 10,
    fightDelayNormal: 0,
    oddsThreshold: 0.62,
    oddsBias: 0,
    militaryBonus: 1,
    behindOddsCut: 0.14,
    leadOddsCut: 0.04,
    catchUp: true,
    defendSpare: 0,
    research: 'practical',
    studySoilKnit: true,
    studyCoil: true,
    formers: 'half',
    fewFormers: false,
    offersExploration: true,
    seeksTreaties: true,
    seeksResearch: false,
    offersAlliance: false,
    opensWars: false,
    breaksPacts: true,
    boldAttacks: false,
    pressesLead: false,
  },
};

/** Trait values used only when Game Options changes that trait off the faction's shipped row. */
const TRAIT_AI: {
  aggression: Record<string, Partial<FactionAi>>;
  expansion: Record<string, Partial<FactionAi>>;
  research: Record<string, Partial<FactionAi>>;
  risk: Record<string, Partial<FactionAi>>;
  diplomacy: Record<string, Partial<FactionAi>>;
} = {
  aggression: {
    'very-aggressive': {
      peaceWindow: 8,
      fightDelayEasy: 0,
      fightDelayNormal: 0,
      oddsBias: 0,
      militaryBonus: 2,
      behindOddsCut: 0.14,
      catchUp: true,
      defendSpare: 0,
      studyCoil: true,
      opensWars: true,
      breaksPacts: true,
    },
    normal: {
      peaceWindow: 12,
      fightDelayEasy: 10,
      fightDelayNormal: 0,
      oddsBias: 0,
      militaryBonus: 1,
      behindOddsCut: 0.14,
      catchUp: true,
      defendSpare: 0,
      studyCoil: true,
      opensWars: false,
      breaksPacts: true,
    },
    easy: {
      peaceWindow: 16,
      fightDelayEasy: 18,
      fightDelayNormal: 14,
      oddsBias: 0.08,
      militaryBonus: 0,
      behindOddsCut: 0,
      catchUp: false,
      defendSpare: 0,
      studyCoil: false,
      opensWars: false,
      breaksPacts: false,
    },
  },
  expansion: {
    expansionist: { cityTarget: 5, podCap: 1, studySoilKnit: false, formers: 'half', fewFormers: true },
    balanced: { cityTarget: 3, podCap: 1, studySoilKnit: true, formers: 'half', fewFormers: false },
    builder: { cityTarget: 2, podCap: 1, studySoilKnit: true, formers: 'each-city', fewFormers: false },
  },
  research: {
    specialty: { research: 'capstone' },
    balanced: { research: 'mixed' },
    general: { research: 'practical' },
  },
  risk: {
    bold: { oddsThreshold: 0.3, boldAttacks: true },
    measured: { oddsThreshold: 0.48, boldAttacks: false },
    cautious: { oddsThreshold: 0.62, boldAttacks: false },
  },
  diplomacy: {
    treaty: { offersExploration: true, seeksResearch: false },
    trader: { offersExploration: true, seeksTreaties: false, seeksResearch: true, offersAlliance: false },
    alone: { offersExploration: false, seeksTreaties: false, seeksResearch: false, offersAlliance: false },
  },
};

function samePersonality(a: Personality, b: Personality): boolean {
  return (
    a.aggression === b.aggression &&
    a.expansion === b.expansion &&
    a.research === b.research &&
    a.diplomacy === b.diplomacy &&
    a.risk === b.risk
  );
}

/** Fields that depend on more than one trait, matching the 0.3.0 rules. */
function crossTraits(personality: Personality): Partial<FactionAi> {
  const pressing = personality.aggression === 'very-aggressive' || personality.risk === 'bold';
  return {
    pressesLead: pressing,
    leadOddsCut: pressing ? 0.12 : 0.04,
    opensWars: personality.aggression === 'very-aggressive' || personality.diplomacy === 'alone',
    seeksTreaties: personality.diplomacy === 'treaty' && personality.aggression !== 'very-aggressive',
    offersAlliance: personality.diplomacy === 'treaty' && personality.aggression === 'easy',
  };
}

/** The row this faction plays with. An unchanged personality returns the shipped row. */
export function factionAi(factionId: FactionId, personality: Personality = FACTIONS[factionId].personality): FactionAi {
  const shipped = FACTION_AI[factionId];
  if (samePersonality(personality, FACTIONS[factionId].personality)) return shipped;
  return {
    ...shipped,
    ...(personality.aggression === FACTIONS[factionId].personality.aggression ? {} : TRAIT_AI.aggression[personality.aggression]),
    ...(personality.expansion === FACTIONS[factionId].personality.expansion ? {} : TRAIT_AI.expansion[personality.expansion]),
    ...(personality.research === FACTIONS[factionId].personality.research ? {} : TRAIT_AI.research[personality.research]),
    ...(personality.risk === FACTIONS[factionId].personality.risk ? {} : TRAIT_AI.risk[personality.risk]),
    ...(personality.diplomacy === FACTIONS[factionId].personality.diplomacy ? {} : TRAIT_AI.diplomacy[personality.diplomacy]),
    ...crossTraits(personality),
  };
}

/** Quiet rounds before this faction will attack, including the difficulty shift. */
export function peaceWindowFor(factionId: FactionId, difficulty: string, personality?: Personality): number {
  const row = factionAi(factionId, personality);
  return Math.max(AI_RULES.peaceMinimum, row.peaceWindow + aggressionAdjust(difficulty));
}
