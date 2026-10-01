export const FACTION_IDS = [
  'helm',
  'verdantia',
  'genesis',
  'ironclad',
  'mnemosyne',
  'clio',
] as const;

export type FactionId = (typeof FACTION_IDS)[number];

export type Zone = 'day' | 'twilight' | 'night';

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

export type ImprovementId =
  | 'plant-trees'
  | 'farm'
  | 'mine'
  | 'solar'
  | 'road'
  | 'atmosphere';

export type Domain = 'land' | 'sea';

export type UnitRole = 'settler' | 'terraformer' | 'scout' | 'military' | 'naval';

export type Difficulty = 'easy' | 'normal' | 'very-aggressive';

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

export interface Tile {
  x: number;
  y: number;
  zone: Zone;
  terrain: TerrainId;
  resource: ResourceId | null;
  improvement: ImprovementId | null;
  livable: boolean;
  road: boolean;
  /** The waking reactor has eaten the livable air off this tile. */
  scarred: boolean;
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

export interface FactionState {
  id: FactionId;
  isHuman: boolean;
  axes: SocialAxes;
  stabilityTurns: number;
  techs: string[];
  researching: string | null;
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

export interface Relation {
  a: FactionId;
  b: FactionId;
  stance: Stance;
  research: boolean;
  exploration: boolean;
  /** Grievance. Higher means a worse memory of the other side. */
  memory: number;
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
  kind: Proposal;
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
  width: number;
  height: number;
  tiles: Tile[];
  factions: Record<FactionId, FactionState>;
  units: Unit[];
  cities: City[];
  nextUnitId: number;
  nextCityId: number;
  explored: Record<FactionId, boolean[]>;
  log: LogEntry[];
  winner: Winner | null;
  alliances: [FactionId, FactionId][];
  relations: Relation[];
  spies: Spy[];
  offers: DiplomaticOffer[];
  nextSpyId: number;
  nextOfferId: number;
  axisHistory: AxisMark[];
  /**
   * Per-turn social stance for the recap. Saves written before this field omit it;
   * loading rebuilds the record from `axisHistory` and the current axes.
   */
  axisDrift?: import('./history').AxisDrift;
}

export interface SaveEnvelope {
  version: 1;
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
