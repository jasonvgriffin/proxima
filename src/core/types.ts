import type { MapSizeId } from '../config';

export type { MapSizeId };

export const FACTION_IDS = [
  'helm',
  'verdantia',
  'genesis',
  'ironclad',
  'mnemosyne',
  'clio',
] as const;

export type FactionId = (typeof FACTION_IDS)[number];

export type TerrainId =
  | 'grass'
  | 'forest'
  | 'rocky'
  | 'highlands'
  | 'ridge'
  | 'canyon'
  | 'coast'
  | 'toxic'
  | 'alien-growth'
  | 'scorched'
  | 'dunes'
  | 'lava'
  | 'thin-air'
  | 'frozen-plain'
  | 'ice-ridge'
  | 'mountain'
  | 'hot-sea'
  | 'temperate-sea'
  | 'frozen-sea';

export type ResourceId = 'minerals' | 'nutrients' | 'energy' | 'ark-debris';

/** Rare deposits. They sit on top of the base terrain yield. */
export type SpecialId = 'crystal' | 'spores' | 'vent' | 'cache';

export type ImprovementId =
  | 'plant-trees'
  | 'farm'
  | 'mine'
  | 'solar'
  | 'road'
  | 'atmosphere';

export type Domain = 'land' | 'sea';

export type UnitRole = 'settler' | 'terraformer' | 'scout' | 'military' | 'naval';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export type Aggression = 'very-aggressive' | 'normal' | 'easy';
export type Expansion = 'expansionist' | 'balanced' | 'builder';
export type ResearchFocus = 'specialty' | 'balanced' | 'general';
export type DiplomacyStyle = 'treaty' | 'trader' | 'alone';
export type Risk = 'cautious' | 'measured' | 'bold';

export interface Personality {
  aggression: Aggression;
  expansion: Expansion;
  research: ResearchFocus;
  diplomacy: DiplomacyStyle;
  risk: Risk;
}

export type SocialAxis = 'religion' | 'values' | 'economy' | 'politics';

export interface SocialAxes {
  religion: string;
  values: string;
  economy: string;
  politics: string;
}

export type SocialStat =
  | 'minerals'
  | 'nutrients'
  | 'energy'
  | 'research'
  | 'credits'
  | 'attack'
  | 'defense';

/** One compact line in a tile's terraform log. */
export interface TerraformEntry {
  round: number;
  factionId: FactionId | null;
  unitName: string | null;
  change: string;
}

/** Last look at a tile, kept so the panel can show remembered ground. */
export interface TileSight {
  terrain: TerrainId;
  elevation: number;
  rainfall: number;
  temperature: number;
  river: boolean;
  resource: ResourceId | null;
  special: SpecialId | null;
  improvement: ImprovementId | null;
  road: boolean;
  scarred: boolean;
  history: TerraformEntry[];
  working: { project: ImprovementId; turnsLeft: number; unitName: string } | null;
}

export interface RecallCity {
  id: number;
  name: string;
  factionId: FactionId;
  population: number;
}

export interface RecallUnit {
  id: number;
  factionId: FactionId;
  role: UnitRole;
  domain: Domain;
  name: string;
}

/** What a faction last saw on one tile. The map draws remembered works from this. */
export interface Recall {
  terrain: TerrainId;
  elevation: number;
  rainfall: number;
  temperature: number;
  river: boolean;
  resource: ResourceId | null;
  special: SpecialId | null;
  improvement: ImprovementId | null;
  road: boolean;
  scarred: boolean;
  working: boolean;
  city: RecallCity | null;
  units: RecallUnit[];
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainId;
  /** 0 (deep water) to 1 (high peak). */
  elevation: number;
  /** 0 dry to 1 wet. */
  rainfall: number;
  /** 0 cold to 1 hot. */
  temperature: number;
  river: boolean;
  resource: ResourceId | null;
  special: SpecialId | null;
  improvement: ImprovementId | null;
  road: boolean;
  /** The waking reactor has torn this tile. */
  scarred: boolean;
  /** Completed terraform, removals, and event or reactor changes. Capped. */
  history: TerraformEntry[];
}

export interface UnitDesign {
  id: string;
  name: string;
  chassis: string;
  weapon: string;
  armor: string;
  specials: string[];
  attack: number;
  defense: number;
  hp: number;
  moves: number;
  vision: number;
  cost: number;
  domain: Domain;
  canFound: boolean;
  canTerraform: boolean;
  searchBonus: number;
  role: UnitRole;
  /** Land units this ship can carry. Comes from the chassis and special parts. */
  transport: number;
}

export interface Unit {
  id: number;
  factionId: FactionId;
  designId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  movesLeft: number;
  maxMoves: number;
  attack: number;
  defense: number;
  vision: number;
  domain: Domain;
  canFound: boolean;
  canTerraform: boolean;
  searchBonus: number;
  role: UnitRole;
  searching: boolean;
  terraform: { project: ImprovementId; turnsLeft: number; total: number } | null;
  starveMarks?: number;
  /** How many land units this ship can carry. */
  transport: number;
  /** Unit ids currently aboard. */
  cargo: number[];
  /** Set when this land unit is loaded on a ship. */
  aboard: number | null;
}

export interface City {
  id: number;
  name: string;
  factionId: FactionId;
  x: number;
  y: number;
  population: number;
  nutrientStore: number;
  starveTurns: number;
  defenseHp: number;
  production: { designId: string; progress: number; cost: number } | null;
}

export type TechOrigin = 'start' | 'research' | 'espionage' | 'treaty';

export interface FactionState {
  id: FactionId;
  isHuman: boolean;
  axes: SocialAxes;
  stabilityTurns: number;
  techs: string[];
  researching: string | null;
  /** Locked technology the faction is working toward. The queue is the prerequisite path. */
  researchGoal: string | null;
  researchQueue: string[];
  /** How each known technology was gained. Missing keys are filled when a save loads. */
  techOrigins: Record<string, TechOrigin>;
  researchPoints: number;
  credits: number;
  minerals: number;
  nutrients: number;
  energy: number;
  customDesigns: UnitDesign[];
  designSerial: number;
  /** Research points gained last turn, for research-treaty sharing. */
  lastResearch: number;
}

export type Stance = 'war' | 'peace' | 'nap' | 'alliance';

export type Proposal = 'peace' | 'nap' | 'alliance' | 'research' | 'exploration';

export interface TradeBundle {
  credits: number;
  minerals: number;
  nutrients: number;
  energy: number;
  tech: string | null;
}

export type EventKind = 'solar-flare' | 'wreckage' | 'betrayal' | 'dust-storm' | 'seismic';

export interface EventChoice {
  id: string;
  label: string;
}

export interface EventPrompt {
  id: number;
  kind: EventKind;
  text: string;
  choices: EventChoice[];
  /** Faction on the other side of a betrayal, when the player is involved. */
  subject?: FactionId;
}

export interface PendingEvent {
  id: number;
  kind: EventKind;
  fireRound: number;
}

export interface GameEvents {
  nextId: number;
  nextRollRound: number;
  pending: PendingEvent | null;
  prompt: EventPrompt | null;
  solarFlareUntil: number;
  dustUntil: number;
  /** The player's units inside their own cities ignore the dust movement penalty. */
  dustShelter: boolean;
}

export interface Relation {
  a: FactionId;
  b: FactionId;
  stance: Stance;
  research: boolean;
  exploration: boolean;
  /** Grievance. Higher means a worse memory of the other side. */
  memory: number;
  /**
   * True once either side has seen the other's unit or city.
   * Saves written before this field omit it; loading treats an existing deal as contact.
   */
  contact: boolean;
}

export interface Spy {
  id: number;
  owner: FactionId;
  /** Null until the spy is embedded in another faction. */
  host: FactionId | null;
}

export interface DiplomaticOffer {
  id: number;
  from: FactionId;
  to: FactionId;
  kind: Proposal | 'trade';
  trade?: { give: TradeBundle; want: TradeBundle };
}

export interface AxisMark {
  round: number;
  axes: SocialAxes;
}

export interface LogEntry {
  round: number;
  text: string;
  factionId?: FactionId;
}

export interface GameSetup {
  difficulty: Difficulty;
  alliedVictory: boolean;
  randomEvents: boolean;
  personalities: Record<FactionId, Personality>;
}

export interface Winner {
  kind: 'solo' | 'alliance';
  factions: FactionId[];
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  round: number;
  playerTurnsCompleted: number;
  playerFaction: FactionId;
  whoseTurn: FactionId;
  lastAiOrder: FactionId[];
  setup: GameSetup;
  autosaveEnabled: boolean;
  /**
   * Size chosen on the new-game screen. Saves written before map sizes omit this;
   * loading treats them as medium, which is the original 60×40 map.
   */
  mapSize: MapSizeId;
  width: number;
  height: number;
  tiles: Tile[];
  factions: Record<FactionId, FactionState>;
  units: Unit[];
  cities: City[];
  nextUnitId: number;
  nextCityId: number;
  explored: Record<FactionId, boolean[]>;
  /**
   * Last-seen ground, cities, and units per faction. Missing on saves from
   * before fog memory; loading fills it.
   */
  recall?: Record<FactionId, (Recall | null)[]>;
  log: LogEntry[];
  winner: Winner | null;
  alliances: [FactionId, FactionId][];
  relations: Relation[];
  spies: Spy[];
  offers: DiplomaticOffer[];
  nextSpyId: number;
  nextOfferId: number;
  axisHistory: AxisMark[];
  /** True once the human faction has no city and no colony pod. */
  playerDefeated: boolean;
  /** Factions already announced as eliminated, so the log does not repeat. */
  eliminated: FactionId[];
  events: GameEvents;
  /**
   * Last-seen tile facts for the human player, keyed `x,y`.
   * Missing keys are either unexplored or from a save that predates this record.
   */
  sight: Record<string, TileSight>;
  /**
   * Per-turn social stance for the recap. Saves written before this field omit it;
   * loading rebuilds the record from `axisHistory` and the current axes.
   */
  axisDrift?: import('./history').AxisDrift;
}

export interface SaveEnvelope {
  /**
   * Save-file schema. 1 is a Proxima 0.1.0 file. 2 is the first 0.2.0 file.
   * 3 adds per-tile terraform history. 4 drops the climate stripe.
   * 5 records which faction pairs have made contact.
   * 6 records the map size. Older files load as medium.
   * Loaders run the migration chain up to the current schema.
   */
  version: number;
  /** Game-state schema copied from `state.version`. Omitted on 0.1.0 files. */
  gameVersion?: number;
  slot: number;
  savedAt: string;
  label: string;
  turn: number;
  year: number;
  week: number;
  faction: string;
  factionId: FactionId;
  state: GameState;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}
