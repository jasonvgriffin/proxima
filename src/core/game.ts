import { CONFIG } from '../config';
import { chooseDesign, runAi, wantsToFight } from './ai';
import { crisisTuning, economyRates, exposureDamage, normalizeDifficulty, scaleStarting } from './difficulty';
import {
  acceptanceChance,
  acceptsTrade,
  applyWar,
  axisOverlap,
  blocksAttack,
  bundleText,
  canOfferTreaty,
  canSetStance,
  downgradeStance,
  findRelation,
  initialRelations,
  proposalLabel,
  sharesMaps,
  sharesResearch,
  tradeValue,
} from './diplomacy';
import { ensureContacts, seesFaction } from './contact';
import { blankEvents, EVENT_KINDS, eventPromptFor, eventWarningText } from './events';
import { frameBlame, missionCaught } from './spies';
import { socialScale, tileYield, withTechFlats, type Yields } from './economy';
import { FACTIONS, defaultAxes, defaultPersonalities, socialOption } from './factions';
import { recordSocialPresent, seedAxisDrift } from './history';
import { exposureOutcome, isExposed, isHostileClimate, softenTile } from './geography';
import { generateMap } from './mapgen';
import { blockedKeys, findPath, reachable as pathReachable } from './path';
import { starterDesigns, designById, compileDesign, type DesignDraft } from './parts';
import { makeRng, type Rng } from './rng';
import {
  attackerWins,
  baseCityCreditIncome,
  biomeClass,
  calendarForRound,
  canFoundCity,
  combatOdds,
  emptyExplored,
  evaluateVictory,
  formatCalendar,
  factionEliminated,
  hasSealedHabitats,
  unitUpkeep,
  isSea,
  projectAllowed,
  rushPayments,
  shouldAutosave,
  terraformEnergy,
  terraformFee,
  terraformTurns,
  terrainDefenseMod,
  winnerHpLoss,
} from './rules';
import { advanceResearchQueue, ensureFactionResearch, nextQueuedResearch, pathToGoal, rememberTech, treatyTechGrants } from './researchPath';
import { ensureRecall, snapshotRecall } from './sight';
import { stripLegacyClimate } from '../platform/saveMigrate';
import { creditFromTechs, formerTechLevel, healFromTechs, startingTechs, techAvailable, techById } from './tech';
import { appendHistory, ensureTileRecords, improvementLines, projectNoun, sightFrom } from './tilelog';
import type {
  ActionResult,
  City,
  Difficulty,
  FactionId,
  GameSetup,
  GameState,
  ImprovementId,
  Proposal,
  Relation,
  SocialAxes,
  SocialAxis,
  Tile,
  TileSight,
  TradeBundle,
  Unit,
  UnitDesign,
} from './types';
import { FACTION_IDS } from './types';

export interface AttackPreview {
  ok: boolean;
  message: string;
  odds: number;
  percent: number;
  terrain: string;
  terrainMod: number;
  defenderName: string;
  defenderHp: number;
  attackerName: string;
  city: boolean;
  navalBombardment: boolean;
}

export interface TileView {
  kind: 'hidden' | 'forgotten' | 'live' | 'stale';
  x: number;
  y: number;
  sight?: TileSight;
  lines?: string[];
}

export interface NewGameOptions {
  seed: number;
  player: FactionId;
  difficulty?: Difficulty;
  alliedVictory?: boolean;
  randomEvents?: boolean;
  personalities?: GameSetup['personalities'];
  axes?: SocialAxes;
  autosaveEnabled?: boolean;
}

export interface EndTurnResult extends ActionResult {
  autosave: boolean;
  aiOrder: FactionId[];
}

export class Game {
  state: GameState;
  /** Bumps on every committed change so the map can redraw only then. */
  revision = 0;
  private rng: Rng;

  constructor(state: GameState) {
    this.state = state;
    for (const faction of Object.values(state.factions)) ensureFactionResearch(faction, { fillMissing: true });
    this.rng = makeRng(state.seed || 1);
    this.rng.setState(state.rngState || 1);
  }

  static newGame(opts: NewGameOptions): Game {
    const seed = opts.seed >>> 0 || 1;
    const rng = makeRng(seed);
    const ids = Object.keys(FACTIONS) as FactionId[];
    const map = generateMap(rng, ids, seed);
    const personalities = opts.personalities ?? defaultPersonalities();
    const difficulty = normalizeDifficulty(opts.difficulty ?? 'normal');
    const setup: GameSetup = {
      difficulty,
      alliedVictory: !!opts.alliedVictory,
      randomEvents: !!opts.randomEvents,
      personalities,
    };
    const factions = {} as GameState['factions'];
    const explored = {} as GameState['explored'];
    for (const id of ids) {
      factions[id] = {
        id,
        isHuman: id === opts.player,
        axes: id === opts.player && opts.axes ? { ...opts.axes } : defaultAxes(id),
        stabilityTurns: 0,
        techs: startingTechs(id),
        researching: null,
        researchGoal: null,
        researchQueue: [],
        techOrigins: Object.fromEntries(startingTechs(id).map((techId) => [techId, 'start' as const])),
        researchPoints: scaleStarting(CONFIG.starting.research, id === opts.player, difficulty),
        credits: scaleStarting(CONFIG.starting.credits, id === opts.player, difficulty),
        minerals: scaleStarting(CONFIG.starting.minerals, id === opts.player, difficulty),
        nutrients: scaleStarting(CONFIG.starting.nutrients, id === opts.player, difficulty),
        energy: scaleStarting(CONFIG.starting.energy, id === opts.player, difficulty),
        customDesigns: [],
        designSerial: 1,
        lastResearch: 0,
      };
      explored[id] = emptyExplored(map.width, map.height);
    }
    const state: GameState = {
      version: 1,
      seed,
      rngState: rng.getState(),
      round: 1,
      playerTurnsCompleted: 0,
      playerFaction: opts.player,
      whoseTurn: opts.player,
      lastAiOrder: [],
      setup,
      autosaveEnabled: opts.autosaveEnabled !== false,
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      factions,
      units: [],
      cities: [],
      nextUnitId: 1,
      nextCityId: 1,
      explored,
      recall: ensureRecall({ width: map.width, height: map.height, explored } as GameState),
      log: [],
      winner: null,
      alliances: [],
      relations: initialRelations(ids),
      spies: [],
      offers: [],
      nextSpyId: 1,
      nextOfferId: 1,
      axisHistory: [{ round: 1, axes: { ...factions[opts.player].axes } }],
      axisDrift: seedAxisDrift(1, factions[opts.player].axes),
      playerDefeated: false,
      eliminated: [],
      events: blankEvents(),
      sight: {},
    };
    const game = new Game(state);
    const designs = starterDesigns();
    const colony = designs.find((d) => d.canFound)!;
    const former = designs.find((d) => d.canTerraform)!;
    const scout = designs.find((d) => d.role === 'scout')!;
    for (const start of map.starts) {
      for (const design of [colony, former, scout]) game.spawn(start.faction, design, start.x, start.y, false);
    }
    if (setup.randomEvents) {
      game.say('Random events are on. They follow no schedule, and a warning is not guaranteed.');
    }
    game.say(`${FACTIONS[opts.player].name} wakes on open ground. Found a city, then set a terraformer to work.`);
    game.beginTurn(opts.player);
    game.noteSight();
    game.commit();
    return game;
  }

  static fromState(state: GameState): Game {
    const copy = JSON.parse(JSON.stringify(state)) as GameState;
    if (!copy.setup) {
      copy.setup = {
        difficulty: 'normal',
        alliedVictory: false,
        randomEvents: false,
        personalities: defaultPersonalities(),
      };
    } else {
      copy.setup.difficulty = normalizeDifficulty(copy.setup.difficulty);
    }
    if (!copy.events) copy.events = blankEvents();
    if (!copy.eliminated) copy.eliminated = [];
    if (copy.playerDefeated == null) copy.playerDefeated = false;
    ensureTileRecords(copy);
    stripLegacyClimate(copy);
    ensureRecall(copy);
    for (const unit of copy.units) {
      if (unit.transport == null) unit.transport = 0;
      if (!unit.cargo) unit.cargo = [];
      if (unit.aboard == null) unit.aboard = null;
    }
    for (const faction of Object.values(copy.factions)) {
      for (const design of faction.customDesigns) {
        if (design.transport == null) design.transport = 0;
      }
    }
    ensureContacts(copy);
    recordSocialPresent(copy);
    const game = new Game(copy);
    game.noteContact();
    game.noteSight();
    return game;
  }

  serialize(): GameState {
    this.noteSight();
    this.commit();
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  tile(x: number, y: number): Tile {
    return this.state.tiles[y * this.state.width + x];
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.state.width && y < this.state.height;
  }

  unitsOf(id: FactionId): Unit[] {
    return this.state.units.filter((unit) => unit.factionId === id);
  }

  citiesOf(id: FactionId): City[] {
    return this.state.cities.filter((city) => city.factionId === id);
  }

  cityAt(x: number, y: number): City | undefined {
    return this.state.cities.find((city) => city.x === x && city.y === y);
  }

  unitById(id: number): Unit | undefined {
    return this.state.units.find((unit) => unit.id === id);
  }

  nearestCityDistance(x: number, y: number): number {
    let best = Infinity;
    for (const city of this.state.cities) {
      best = Math.min(best, Math.max(Math.abs(city.x - x), Math.abs(city.y - y)));
    }
    return best;
  }

  isExplored(faction: FactionId, x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.state.explored[faction][y * this.state.width + x];
  }

  isVisible(faction: FactionId, x: number, y: number): boolean {
    if (!this.isExplored(faction, x, y)) return false;
    for (const unit of this.unitsOf(faction)) {
      const r = this.visionOf(unit);
      if (Math.max(Math.abs(unit.x - x), Math.abs(unit.y - y)) <= r) return true;
    }
    for (const city of this.citiesOf(faction)) {
      if (Math.max(Math.abs(city.x - x), Math.abs(city.y - y)) <= CONFIG.map.cityVision) return true;
    }
    return false;
  }

  /**
   * Fog for one faction, matching the map mask: 2 in sight, 1 remembered, 0 unknown.
   * Contact uses 2 only. Remembered ground does not count as a meeting.
   */
  fogState(faction: FactionId, x: number, y: number): 0 | 1 | 2 {
    if (!this.inBounds(x, y)) return 0;
    if (this.isVisible(faction, x, y)) return 2;
    if (this.isExplored(faction, x, y)) return 1;
    return 0;
  }

  calendar(): { year: number; week: number; label: string } {
    const cal = calendarForRound(this.state.round);
    return { ...cal, label: formatCalendar(this.state.round) };
  }

  designsFor(factionId: FactionId): UnitDesign[] {
    const faction = this.state.factions[factionId];
    return [
      ...starterDesigns().filter((design) => this.designAllowed(faction.techs, design)),
      ...faction.customDesigns,
    ];
  }

  findDesign(factionId: FactionId, designId: string): UnitDesign | undefined {
    return designById(designId, this.state.factions[factionId].customDesigns);
  }

  /** Seeded draw. Saved with the game, so events and AI rolls survive a load. */
  roll(): number {
    return this.rng.next();
  }

  route(unitId: number, x: number, y: number): { x: number; y: number }[] | null {
    const unit = this.unitById(unitId);
    if (!unit || unit.aboard != null || !this.inBounds(x, y)) return null;
    return findPath({
      tiles: this.state.tiles,
      width: this.state.width,
      height: this.state.height,
      origin: unit,
      goal: { x, y },
      domain: unit.domain,
      blocked: blockedKeys(this.state.units, this.state.cities, unit),
    });
  }

  reachable(unitId: number): Map<string, { cost: number; path: { x: number; y: number }[] }> {
    const unit = this.unitById(unitId);
    if (!unit || unit.terraform || unit.movesLeft <= 0 || unit.aboard != null) return new Map();
    return pathReachable({
      tiles: this.state.tiles,
      width: this.state.width,
      height: this.state.height,
      origin: unit,
      moves: unit.movesLeft,
      domain: unit.domain,
      blocked: blockedKeys(this.state.units, this.state.cities, unit),
    });
  }

  cityReport(cityId: number): {
    yields: Yields;
    credits: number;
    worked: { x: number; y: number }[];
    need: number;
  } | null {
    const city = this.state.cities.find((c) => c.id === cityId);
    if (!city) return null;
    const faction = this.state.factions[city.factionId];
    const worked = this.workedTiles(city);
    const raw = withTechFlats(
      worked.reduce((sum, tile) => add(sum, tileYield(tile, faction.techs)), {
        minerals: CONFIG.city.baseMinerals,
        nutrients: CONFIG.city.baseNutrients,
        energy: CONFIG.city.baseEnergy,
        research: CONFIG.city.baseResearch,
      } as Yields),
      faction.techs,
    );
    const rates = economyRates(faction.isHuman, this.state.setup.difficulty);
    const crisis = crisisTuning(this.state.round, this.state.setup.difficulty).yieldFactor;
    const dust = this.state.events.dustUntil >= this.state.round ? 1 - CONFIG.events.dustYieldPenalty : 1;
    const yields: Yields = {
      minerals: Math.max(0, Math.round(raw.minerals * socialScale(faction, 'minerals') * rates.production * crisis * dust)),
      nutrients: Math.max(0, Math.round(raw.nutrients * socialScale(faction, 'nutrients') * crisis * dust)),
      energy: Math.max(0, Math.round(raw.energy * socialScale(faction, 'energy') * crisis * dust)),
      research: Math.max(0, Math.round(raw.research * socialScale(faction, 'research') * rates.research * crisis * dust)),
    };
    const credits = this.creditIncome(city, faction);
    return { yields, credits, worked: worked.map((tile) => ({ x: tile.x, y: tile.y })), need: city.population * CONFIG.city.nutrientsPerPop };
  }

  ratesFor(factionId: FactionId): Yields & { credits: number } {
    const totals = { minerals: 0, nutrients: 0, energy: 0, research: 0, credits: 0 };
    for (const city of this.citiesOf(factionId)) {
      const report = this.cityReport(city.id);
      if (!report) continue;
      totals.minerals += report.yields.minerals;
      totals.nutrients += report.yields.nutrients;
      totals.energy += report.yields.energy;
      totals.research += report.yields.research;
      totals.credits += report.credits;
    }
    return totals;
  }

  moveUnit(unitId: number, x: number, y: number): ActionResult & { path?: { x: number; y: number }[] } {
    const unit = this.controlled(unitId);
    if (!unit) return fail('That unit cannot take orders.');
    if (unit.aboard != null) return fail('That unit is aboard a ship.');
    if (unit.terraform) return fail('This terraformer has to finish the tile first.');
    if (unit.movesLeft <= 0) return fail('No movement left this turn.');
    const step = this.reachable(unitId).get(`${x},${y}`);
    if (!step || step.cost <= 0) return fail('That tile is out of reach.');
    unit.x = x;
    unit.y = y;
    unit.movesLeft -= step.cost;
    for (const riderId of unit.cargo) {
      const rider = this.unitById(riderId);
      if (rider) {
        rider.x = x;
        rider.y = y;
      }
    }
    this.revealAround(unit);
    this.commit();
    return { ok: true, message: `${unit.name} moves.`, path: step.path };
  }

  foundCity(unitId: number): ActionResult {
    const unit = this.controlled(unitId);
    if (!unit) return fail('That unit cannot take orders.');
    const tile = this.tile(unit.x, unit.y);
    const faction = this.state.factions[unit.factionId];
    const check = canFoundCity({
      canFound: unit.canFound,
      sea: isSea(tile.terrain),
      hostile: isHostileClimate(tile.terrain),
      sealed: hasSealedHabitats(faction.techs),
      nearestCity: this.nearestCityDistance(unit.x, unit.y),
      cityHere: !!this.cityAt(unit.x, unit.y),
    });
    if (!check.ok) return fail(check.reason);
    if (this.state.units.some((other) => other.id !== unit.id && other.x === unit.x && other.y === unit.y && other.factionId !== unit.factionId)) {
      return fail('Enemy units still hold this tile.');
    }
    const name = this.nextCityName(unit.factionId);
    this.state.cities.push({
      id: this.state.nextCityId++,
      name,
      factionId: unit.factionId,
      x: unit.x,
      y: unit.y,
      population: CONFIG.city.startingPopulation,
      nutrientStore: 0,
      starveTurns: 0,
      defenseHp: CONFIG.city.militiaHp,
      production: null,
    });
    this.removeUnit(unit);
    this.reveal(unit.factionId, unit.x, unit.y, CONFIG.map.cityVision);
    this.say(`${FACTIONS[unit.factionId].name} founds ${name}.`, unit.factionId);
    this.checkVictory();
    this.commit();
    return { ok: true, message: `Founded ${name}.` };
  }

  startTerraform(unitId: number, project: ImprovementId): ActionResult {
    const unit = this.controlled(unitId);
    if (!unit) return fail('That unit cannot take orders.');
    if (!unit.canTerraform) return fail('This unit has no terraforming gear.');
    if (unit.terraform) return fail('Already working a tile.');
    const tile = this.tile(unit.x, unit.y);
    if (isSea(tile.terrain)) return fail('Open water cannot be terraformed.');
    if (this.state.units.some((other) => other.id !== unit.id && other.x === unit.x && other.y === unit.y && other.terraform)) {
      return fail('Another terraformer is already working this tile.');
    }
    const faction = this.state.factions[unit.factionId];
    if (!projectAllowed(project, faction.techs)) {
      return fail('Atmosphere work needs Basic Atmosphere and Soil Science.');
    }
    const fee = terraformFee(biomeClass(tile));
    const energy = terraformEnergy(project);
    if (faction.credits < fee) return fail(`Terraforming costs ${fee} credits.`);
    if (faction.energy < energy) return fail(`Terraforming costs ${energy} energy.`);
    const turns = terraformTurns(project, formerTechLevel(faction.techs));
    faction.credits -= fee;
    faction.energy -= energy;
    unit.terraform = { project, turnsLeft: turns, total: turns };
    unit.movesLeft = 0;
    this.say(`${unit.name} begins ${projectLabel(project)} (${turns} turns, ${fee} credits, ${energy} energy).`, unit.factionId);
    this.commit();
    return { ok: true, message: `${projectLabel(project)} started. ${turns} turns, ${fee} credits, ${energy} energy.` };
  }

  toggleSearch(unitId: number): ActionResult {
    const unit = this.controlled(unitId);
    if (!unit) return fail('That unit cannot take orders.');
    unit.searching = !unit.searching;
    this.commit();
    return { ok: true, message: unit.searching ? `${unit.name} will search.` : `${unit.name} stops searching.` };
  }

  previewAttack(unitId: number, x: number, y: number): AttackPreview {
    const empty: AttackPreview = {
      ok: false,
      message: 'No attack.',
      odds: 0,
      percent: 0,
      terrain: '',
      terrainMod: 0,
      defenderName: '',
      defenderHp: 0,
      attackerName: '',
      city: false,
      navalBombardment: false,
    };
    const unit = this.unitById(unitId);
    if (!unit || unit.factionId !== this.state.whoseTurn) return { ...empty, message: 'That unit cannot attack.' };
    if (unit.attack <= 0) return { ...empty, message: 'This unit has no weapon.' };
    if (unit.movesLeft <= 0 || unit.terraform) return { ...empty, message: 'This unit cannot attack right now.' };
    if (!this.inBounds(x, y)) return { ...empty, message: 'Off the map.' };
    if (Math.max(Math.abs(unit.x - x), Math.abs(unit.y - y)) !== 1) {
      return { ...empty, message: 'Attacks reach an adjacent tile.' };
    }
    const tile = this.tile(x, y);
    const enemies = this.state.units.filter((other) => other.x === x && other.y === y && other.factionId !== unit.factionId);
    const city = this.cityAt(x, y);
    const enemyCity = city && city.factionId !== unit.factionId ? city : undefined;
    if (!enemies.length && !enemyCity) return { ...empty, message: 'Nothing hostile there.' };
    const defenderUnit = enemies.slice().sort((a, b) => b.defense - a.defense || b.hp - a.hp)[0];
    const inCity = !!enemyCity;
    const terrainMod = terrainDefenseMod(tile.terrain, inCity);
    let defenderName = defenderUnit?.name ?? `${enemyCity?.name ?? 'City'} militia`;
    let defender: { attack: number; defense: number; hp: number; maxHp: number };
    let defenderHp = 0;
    if (defenderUnit) {
      defender = defenderUnit;
      defenderHp = defenderUnit.hp;
      if (inCity) defenderName = `${defenderUnit.name} in ${enemyCity?.name}`;
    } else if (enemyCity) {
      defender = {
        attack: 1,
        defense: CONFIG.city.militiaDefense + Math.floor(enemyCity.population / 2),
        hp: enemyCity.defenseHp,
        maxHp: CONFIG.city.militiaHp,
      };
      defenderHp = enemyCity.defenseHp;
    } else {
      return { ...empty, message: 'Nothing hostile there.' };
    }
    const odds = combatOdds(unit, defender, terrainMod);
    const navalBombardment = unit.domain === 'sea' && (!!enemyCity || defenderUnit?.domain === 'land');
    return {
      ok: true,
      message: `${Math.round(odds * 100)}% chance to win.`,
      odds,
      percent: Math.round(odds * 100),
      terrain: tile.terrain,
      terrainMod,
      defenderName,
      defenderHp,
      attackerName: unit.name,
      city: !!enemyCity,
      navalBombardment,
    };
  }

  confirmAttack(unitId: number, x: number, y: number): ActionResult {
    const preview = this.previewAttack(unitId, x, y);
    if (!preview.ok) return fail(preview.message);
    const unit = this.unitById(unitId)!;
    const foeId = this.enemyFactionAt(unit.factionId, x, y);
    if (foeId) {
      const rel = this.relation(unit.factionId, foeId);
      if (blocksAttack(rel.stance)) return fail('A pact holds. Break it before you attack.');
      if (rel.stance === 'peace') {
        Object.assign(rel, applyWar(rel));
        this.syncAlliances();
        this.say(`${FACTIONS[unit.factionId].name} breaks the peace with ${FACTIONS[foeId].name}.`, unit.factionId);
      }
    }
    const roll = this.rng.next();
    const win = attackerWins(preview.odds, roll);
    const tile = this.tile(x, y);
    const city = this.cityAt(x, y);
    const enemyCity = city && city.factionId !== unit.factionId ? city : undefined;
    const enemies = this.state.units.filter((other) => other.x === x && other.y === y && other.factionId !== unit.factionId);
    const defenderUnit = enemies.slice().sort((a, b) => b.defense - a.defense || b.hp - a.hp)[0];
    unit.movesLeft = 0;
    const pct = preview.percent;
    if (win) {
      const loss = winnerHpLoss(unit.maxHp, preview.odds);
      unit.hp -= loss;
      if (defenderUnit) this.removeUnit(defenderUnit);
      if (unit.hp <= 0) {
        this.removeUnit(unit);
        this.say(`${preview.attackerName} breaks ${preview.defenderName}, and is lost doing it (${pct}%).`, unit.factionId);
      } else if (enemyCity && !this.enemiesAt(enemyCity.factionId, x, y).length) {
        if (unit.domain === 'land') {
          enemyCity.factionId = unit.factionId;
          enemyCity.production = null;
          enemyCity.nutrientStore = 0;
          enemyCity.starveTurns = 0;
          enemyCity.defenseHp = CONFIG.city.militiaHp;
          unit.x = x;
          unit.y = y;
          this.revealAround(unit);
          this.say(`${FACTIONS[unit.factionId].name} captures ${enemyCity.name} (${pct}%).`, unit.factionId);
        } else {
          enemyCity.defenseHp = Math.max(1, enemyCity.defenseHp - CONFIG.combat.bombardmentCityDamage);
          this.say(`${unit.name} bombards ${enemyCity.name} (${pct}%). Ships cannot capture a city.`, unit.factionId);
        }
      } else if (defenderUnit && unit.domain === 'land' && this.canEnter(unit, tile) && !this.enemiesAt(defenderUnit.factionId, x, y).length) {
        unit.x = x;
        unit.y = y;
        this.revealAround(unit);
        this.say(`${unit.name} defeats ${preview.defenderName} (${pct}%).`, unit.factionId);
      } else {
        this.say(`${unit.name} defeats ${preview.defenderName} (${pct}%).`, unit.factionId);
      }
    } else {
      this.removeUnit(unit);
      if (defenderUnit) {
        defenderUnit.hp -= winnerHpLoss(defenderUnit.maxHp, 1 - preview.odds);
        if (defenderUnit.hp <= 0) this.removeUnit(defenderUnit);
      } else if (enemyCity) {
        enemyCity.defenseHp = Math.max(1, enemyCity.defenseHp - 2);
      }
      this.say(`${preview.attackerName} is lost attacking ${preview.defenderName} (${pct}%).`, unit.factionId);
    }
    this.checkVictory();
    this.commit();
    return { ok: true, message: win ? `Victory (${pct}%).` : `Defeat (${pct}%).` };
  }

  setProduction(cityId: number, designId: string): ActionResult {
    const city = this.controlledCity(cityId);
    if (!city) return fail('That city is not yours to order.');
    const design = this.findDesign(city.factionId, designId);
    if (!design || !this.designAllowed(this.state.factions[city.factionId].techs, design)) {
      return fail('That design is not available.');
    }
    city.production = { designId: design.id, progress: 0, cost: design.cost };
    this.commit();
    return { ok: true, message: `${city.name} will build ${design.name}.` };
  }

  rushBuy(cityId: number): ActionResult {
    const city = this.controlledCity(cityId);
    if (!city || !city.production) return fail('Nothing is being built here.');
    const remaining = city.production.cost - city.production.progress;
    const cost = rushPayments(remaining);
    if (cost.credits <= 0) return fail('The build is already finished.');
    const faction = this.state.factions[city.factionId];
    if (faction.credits < cost.credits) return fail(`Rush-buy costs ${cost.credits} credits.`);
    if (faction.minerals < cost.minerals || faction.nutrients < cost.nutrients || faction.energy < cost.energy) {
      return fail(`Rush-buy also needs ${cost.minerals} minerals, ${cost.nutrients} nutrients, and ${cost.energy} energy.`);
    }
    const design = this.findDesign(city.factionId, city.production.designId);
    if (!design) return fail('The design is gone.');
    faction.credits -= cost.credits;
    faction.minerals -= cost.minerals;
    faction.nutrients -= cost.nutrients;
    faction.energy -= cost.energy;
    city.production = null;
    this.spawn(city.factionId, design, city.x, city.y, true);
    this.say(
      `${city.name} rush-buys ${design.name} for ${cost.credits} credits, ${cost.minerals} minerals, ${cost.nutrients} nutrients, and ${cost.energy} energy.`,
      city.factionId,
    );
    this.commit();
    return { ok: true, message: `Rushed ${design.name} for ${cost.credits} credits and stockpiled resources.` };
  }

  chooseResearch(techId: string): ActionResult {
    const faction = this.state.factions[this.state.whoseTurn];
    ensureFactionResearch(faction);
    const tech = techById(techId);
    if (!tech) return fail('Unknown technology.');
    if (faction.techs.includes(techId)) return fail('Already known.');
    if (!techAvailable(tech, faction.techs)) return fail('Requirements missing.');
    if (faction.researchGoal && !faction.researchQueue.includes(techId)) {
      faction.researchGoal = null;
      faction.researchQueue = [];
    }
    faction.researching = techId;
    this.finishResearchGrants(faction.id);
    this.commit();
    return { ok: true, message: `Researching ${tech.name}.` };
  }

  /** Queue the prerequisite path for a locked technology and start the first step. */
  setResearchGoal(techId: string): ActionResult {
    const faction = this.state.factions[this.state.whoseTurn];
    ensureFactionResearch(faction);
    const tech = techById(techId);
    if (!tech) return fail('Unknown technology.');
    const path = pathToGoal(techId, faction.techs);
    if (!path) return fail('That technology cannot be reached.');
    if (!path.length) return fail('Already known.');
    faction.researchGoal = techId;
    faction.researchQueue = path;
    const next = nextQueuedResearch(path, faction.techs);
    if (next) faction.researching = next;
    this.finishResearchGrants(faction.id);
    this.commit();
    const names = path.map((id) => techById(id)?.name ?? id).join(', ');
    return { ok: true, message: `Research goal: ${tech.name}. Path: ${names}.` };
  }

  setSocial(axis: SocialAxis, optionId: string): ActionResult {
    const faction = this.state.factions[this.state.whoseTurn];
    if (!faction.isHuman) return fail('Only you reshape your society directly.');
    if (faction.axes[axis] === optionId) return fail('That choice is already in place.');
    if (!socialOption(axis, optionId)) return fail('Unknown social choice.');
    if (faction.credits < CONFIG.social.switchCost) {
      return fail(`Switching an axis costs ${CONFIG.social.switchCost} credits.`);
    }
    faction.credits -= CONFIG.social.switchCost;
    faction.axes[axis] = optionId;
    faction.stabilityTurns = CONFIG.social.stabilityHitTurns;
    this.state.axisHistory.push({ round: this.state.round, axes: { ...faction.axes } });
    recordSocialPresent(this.state);
    this.say(`Society shifts. Stability is shaken for ${CONFIG.social.stabilityHitTurns} turns.`, faction.id);
    this.commit();
    return { ok: true, message: `Axis changed. ${CONFIG.social.switchCost} credits, stability shaken.` };
  }

  createDesign(draft: DesignDraft): ActionResult {
    const faction = this.state.factions[this.state.whoseTurn];
    const id = `custom-${faction.id}-${faction.designSerial++}`;
    const compiled = compileDesign(draft, faction.techs, id);
    if (!compiled.ok) return fail(compiled.error);
    faction.customDesigns.push(compiled.design);
    this.commit();
    return { ok: true, message: `Design saved: ${compiled.design.name}.` };
  }

  relation(a: FactionId, b: FactionId): Relation {
    const found = findRelation(this.state.relations, a, b);
    if (!found) throw new Error(`No relation between ${a} and ${b}`);
    return found;
  }

  /**
   * Contact sticks once either side has a unit or city in current sight.
   * The look goes through `seesFaction`, which asks for fog state 2 and ignores remembered ground.
   */
  noteContact(): void {
    const places = [...this.state.units, ...this.state.cities];
    const visible = (viewer: FactionId, x: number, y: number) => this.fogState(viewer, x, y) === 2;
    for (const rel of this.state.relations) {
      if (rel.contact) continue;
      if (seesFaction(rel.a, rel.b, places, visible) || seesFaction(rel.b, rel.a, places, visible)) {
        rel.contact = true;
      }
    }
  }

  inContact(a: FactionId, b: FactionId): boolean {
    if (a === b) return false;
    this.noteContact();
    return this.relation(a, b).contact;
  }

  mapPartners(viewer: FactionId): FactionId[] {
    const partners: FactionId[] = [];
    for (const rel of this.state.relations) {
      const other = rel.a === viewer ? rel.b : rel.b === viewer ? rel.a : null;
      if (other && sharesMaps(rel)) partners.push(other);
    }
    for (const spy of this.state.spies) {
      if (spy.owner === viewer && spy.host && !partners.includes(spy.host)) partners.push(spy.host);
    }
    return partners;
  }

  playerSees(x: number, y: number): boolean {
    const viewer = this.state.playerFaction;
    if (this.isExplored(viewer, x, y)) return true;
    return this.mapPartners(viewer).some((id) => this.isExplored(id, x, y));
  }

  /** True when the player, or a faction sharing maps, can see the tile right now. */
  currentlySeen(x: number, y: number): boolean {
    const viewer = this.state.playerFaction;
    if (this.isVisible(viewer, x, y)) return true;
    return this.mapPartners(viewer).some((id) => this.isVisible(id, x, y));
  }

  /**
   * What the tile panel may show. Unexplored tiles are hidden.
   * Tiles in current vision are live. Remembered tiles use the last look.
   */
  tileView(x: number, y: number): TileView {
    if (!this.inBounds(x, y) || !this.playerSees(x, y)) return { kind: 'hidden', x, y };
    const live = this.currentlySeen(x, y);
    if (live) {
      const tile = this.tile(x, y);
      return { kind: 'live', x, y, sight: sightFrom(tile, this.workingOn(tile)), lines: improvementLines(tile) };
    }
    const remembered = this.state.sight[`${x},${y}`];
    if (!remembered) return { kind: 'forgotten', x, y };
    return { kind: 'stale', x, y, sight: remembered, lines: improvementLines(remembered) };
  }

  /** Refresh the last-seen record for tiles in current vision. */
  noteSight(): void {
    for (const tile of this.state.tiles) {
      if (!this.currentlySeen(tile.x, tile.y)) continue;
      this.state.sight[`${tile.x},${tile.y}`] = sightFrom(tile, this.workingOn(tile));
    }
  }

  /** Finishes a terraforming job immediately. The panel and tests use this to skip the wait. */
  advanceTerraform(unitId: number): ActionResult {
    const unit = this.unitById(unitId);
    if (!unit?.terraform) return fail('Nothing is being built on that tile.');
    unit.terraform.turnsLeft = 0;
    this.completeTerraform(unit);
    this.noteSight();
    this.commit();
    return { ok: true, message: 'The work is finished.' };
  }

  intel(host: FactionId): {
    credits: number;
    minerals: number;
    nutrients: number;
    energy: number;
    researchPoints: number;
    researching: string | null;
    techs: string[];
  } | null {
    const viewer = this.state.whoseTurn;
    const embedded = this.state.spies.some((spy) => spy.owner === viewer && spy.host === host);
    if (!embedded) return null;
    const faction = this.state.factions[host];
    return {
      credits: faction.credits,
      minerals: faction.minerals,
      nutrients: faction.nutrients,
      energy: faction.energy,
      researchPoints: faction.researchPoints,
      researching: faction.researching,
      techs: [...faction.techs],
    };
  }

  propose(target: FactionId, kind: 'war' | Proposal, agreed = false): ActionResult {
    const actor = this.state.whoseTurn;
    if (this.state.winner) return fail('The game is over.');
    if (actor === target) return fail('A faction cannot treat with itself.');
    if (!this.inContact(actor, target)) return fail('No contact with that faction yet.');
    if (kind !== 'war' && this.flareActive()) return fail('A solar flare is scrambling comms.');
    const rel = this.relation(actor, target);
    if (kind === 'war') {
      Object.assign(rel, applyWar(rel));
      this.state.offers = this.state.offers.filter((offer) => !this.offerTouches(offer, actor, target));
      this.syncAlliances();
      this.say(`${FACTIONS[actor].name} declares war on ${FACTIONS[target].name}.`, actor);
      this.commit();
      return { ok: true, message: `War declared on ${FACTIONS[target].name}.` };
    }
    if (kind === 'peace' || kind === 'nap' || kind === 'alliance') {
      const gate = canSetStance(rel.stance, kind);
      if (!gate.ok) return fail(gate.reason);
    } else {
      const gate = canOfferTreaty(rel.stance);
      if (!gate.ok) return fail(gate.reason);
      if (kind === 'research' && rel.research) return fail('A research treaty is already in force.');
      if (kind === 'exploration' && rel.exploration) return fail('An exploration treaty is already in force.');
    }
    const targetIsHuman = this.state.factions[target].isHuman;
    const actorIsHuman = this.state.factions[actor].isHuman;
    if (!agreed && targetIsHuman && !actorIsHuman) {
      if (this.state.offers.some((offer) => offer.from === actor && offer.to === target && offer.kind === kind)) {
        return fail('That offer is already waiting.');
      }
      this.state.offers.push({ id: this.state.nextOfferId++, from: actor, to: target, kind });
      this.say(`${FACTIONS[actor].name} offers ${proposalLabel(kind)} to ${FACTIONS[target].name}.`, actor);
      this.commit();
      return { ok: true, message: 'Offer sent.' };
    }
    if (!agreed && !this.accepts(target, actor, kind)) {
      rel.memory = Math.min(100, rel.memory + CONFIG.diplomacy.rejectMemory);
      this.say(`${FACTIONS[target].name} refuses ${proposalLabel(kind)}.`, target);
      this.commit();
      return { ok: false, message: `${FACTIONS[target].name} refuses.` };
    }
    this.applyProposal(rel, kind);
    this.syncAlliances();
    this.say(`${FACTIONS[actor].name} and ${FACTIONS[target].name} agree on ${proposalLabel(kind)}.`, actor);
    this.commit();
    return { ok: true, message: `Agreed: ${proposalLabel(kind)}.` };
  }

  proposeTrade(target: FactionId, give: TradeBundle, want: TradeBundle): ActionResult {
    const actor = this.state.whoseTurn;
    if (this.state.winner || this.state.playerDefeated) return fail('The game is over.');
    if (actor === target) return fail('A faction cannot trade with itself.');
    if (!this.inContact(actor, target)) return fail('No contact with that faction yet.');
    if (this.flareActive()) return fail('A solar flare is scrambling comms.');
    const rel = this.relation(actor, target);
    if (rel.stance === 'war') return fail('There is no trade in wartime.');
    if (!this.canPay(actor, give) || (give.tech && !this.state.factions[actor].techs.includes(give.tech))) {
      return fail('You cannot offer that.');
    }
    if (want.tech && !this.state.factions[target].techs.includes(want.tech)) return fail('They do not know that technology.');
    const targetIsHuman = this.state.factions[target].isHuman;
    if (targetIsHuman && this.state.factions[actor].isHuman === false) {
      this.state.offers.push({ id: this.state.nextOfferId++, from: actor, to: target, kind: 'trade', trade: { give, want } });
      this.say(
        `${FACTIONS[actor].name} offers ${bundleText(give)} for ${bundleText(want)}.`,
        actor,
      );
      this.commit();
      return { ok: true, message: 'Trade offered.' };
    }
    const personality = this.state.setup.personalities[target];
    const offered = tradeValue(give, this.state.factions[target].techs.includes(give.tech ?? ''));
    const asked = tradeValue(want, this.state.factions[actor].techs.includes(want.tech ?? ''));
    const willing = acceptsTrade({
      diplomacy: personality.diplomacy,
      memory: rel.memory,
      stance: rel.stance,
      offered,
      asked,
    });
    if (!this.canPay(target, want) || !willing) {
      rel.memory = Math.min(100, rel.memory + CONFIG.diplomacy.rejectMemory);
      this.say(`${FACTIONS[target].name} refuses the trade.`, target);
      this.commit();
      return { ok: false, message: `${FACTIONS[target].name} refuses the trade.` };
    }
    this.transferTrade(actor, target, give, want);
    this.say(`${FACTIONS[actor].name} and ${FACTIONS[target].name} trade ${bundleText(give)} for ${bundleText(want)}.`, actor);
    this.commit();
    return { ok: true, message: 'Trade agreed.' };
  }

  acceptOffer(offerId: number): ActionResult {
    if (this.state.whoseTurn !== this.state.playerFaction) return fail('Not your turn.');
    const offer = this.state.offers.find((entry) => entry.id === offerId && entry.to === this.state.playerFaction);
    if (!offer) return fail('That offer is gone.');
    if (offer.kind === 'trade' && offer.trade) {
      const { give, want } = offer.trade;
      if (!this.canPay(offer.from, give) || !this.canPay(offer.to, want)) return fail('One side can no longer pay.');
      this.transferTrade(offer.from, offer.to, give, want);
      this.state.offers = this.state.offers.filter((entry) => entry.id !== offerId);
      this.say(
        `${FACTIONS[offer.to].name} accepts a trade of ${bundleText(give)} for ${bundleText(want)}.`,
        offer.to,
      );
      this.commit();
      return { ok: true, message: 'Trade accepted.' };
    }
    if (offer.kind === 'trade') return fail('That trade is incomplete.');
    const rel = this.relation(offer.from, offer.to);
    if (offer.kind === 'peace' || offer.kind === 'nap' || offer.kind === 'alliance') {
      const gate = canSetStance(rel.stance, offer.kind);
      if (!gate.ok) return fail(gate.reason);
    } else if (!canOfferTreaty(rel.stance).ok) return fail('The war has already closed that treaty.');
    this.applyProposal(rel, offer.kind);
    this.state.offers = this.state.offers.filter((entry) => entry.id !== offerId);
    this.syncAlliances();
    this.say(`${FACTIONS[this.state.playerFaction].name} accepts ${proposalLabel(offer.kind)} from ${FACTIONS[offer.from].name}.`, this.state.playerFaction);
    this.commit();
    return { ok: true, message: 'Offer accepted.' };
  }

  rejectOffer(offerId: number): ActionResult {
    const offer = this.state.offers.find((entry) => entry.id === offerId);
    if (!offer) return fail('That offer is gone.');
    this.relation(offer.from, offer.to).memory = Math.min(100, this.relation(offer.from, offer.to).memory + CONFIG.diplomacy.rejectMemory);
    this.state.offers = this.state.offers.filter((entry) => entry.id !== offerId);
    this.say(`${FACTIONS[offer.to].name} rejects ${proposalLabel(offer.kind)}.`, offer.to);
    this.commit();
    return { ok: true, message: 'Offer rejected.' };
  }

  recruitSpy(): ActionResult {
    if (this.state.winner) return fail('The game is over.');
    const faction = this.state.factions[this.state.whoseTurn];
    if (faction.credits < CONFIG.spies.recruitCost) {
      return fail(`A spy costs ${CONFIG.spies.recruitCost} credits.`);
    }
    faction.credits -= CONFIG.spies.recruitCost;
    this.state.spies.push({ id: this.state.nextSpyId++, owner: faction.id, host: null });
    this.say(`${FACTIONS[faction.id].name} recruits a spy. No upkeep is due.`, faction.id);
    this.commit();
    return { ok: true, message: `Spy recruited for ${CONFIG.spies.recruitCost} credits.` };
  }

  placeSpy(spyId: number, host: FactionId): ActionResult {
    const spy = this.ownedSpy(spyId);
    if (!spy) return fail('That spy is not yours.');
    if (host === spy.owner) return fail('A spy has to be placed in another faction.');
    spy.host = host;
    this.say(`A spy is inside ${FACTIONS[host].name}. Their map, stocks, and research are visible.`, spy.owner);
    this.commit();
    return { ok: true, message: `Spy placed in ${FACTIONS[host].name}.` };
  }

  stealTech(spyId: number, techId: string): ActionResult {
    return this.resolveTheft(spyId, techId);
  }

  resolveTheft(spyId: number, techId: string, roll = this.rng.next()): ActionResult {
    const spy = this.ownedSpy(spyId);
    if (!spy?.host) return fail('Place the spy before they can steal.');
    const host = this.state.factions[spy.host];
    const owner = this.state.factions[spy.owner];
    if (!host.techs.includes(techId)) return fail('They do not have that technology.');
    if (owner.techs.includes(techId)) return fail('You already know it.');
    if (missionCaught(roll, CONFIG.spies.theftCatch)) {
      this.burnSpy(spy.id, `${FACTIONS[spy.host].name} catches a thief. The ${techId} notes are lost.`);
      return { ok: false, message: 'The spy was caught.' };
    }
    owner.techs.push(techId);
    ensureFactionResearch(owner);
    rememberTech(owner.techOrigins, techId, 'espionage');
    if (owner.researching === techId) owner.researching = null;
    const next = advanceResearchQueue(owner);
    if (!owner.researching && next) owner.researching = next;
    this.say(`Stolen from ${FACTIONS[spy.host].name}: ${techById(techId)?.name ?? techId}.`, spy.owner);
    this.commit();
    return { ok: true, message: 'Technology stolen.' };
  }

  sabotage(spyId: number): ActionResult {
    return this.resolveSabotage(spyId);
  }

  resolveSabotage(spyId: number, roll = this.rng.next()): ActionResult {
    const spy = this.ownedSpy(spyId);
    if (!spy?.host) return fail('Place the spy before they can sabotage.');
    if (missionCaught(roll, CONFIG.spies.sabotageCatch)) {
      this.burnSpy(spy.id, `${FACTIONS[spy.host].name} catches a saboteur.`);
      return { ok: false, message: 'The saboteur was caught.' };
    }
    const improved = this.state.tiles.find(
      (tile) => tile.improvement && this.citiesOf(spy.host!).some((city) => Math.max(Math.abs(city.x - tile.x), Math.abs(city.y - tile.y)) <= CONFIG.city.workRadius),
    );
    if (improved?.improvement) {
      const what = improved.improvement;
      improved.improvement = null;
      this.recordTile(improved, `removed ${projectNoun(what)}`, spy.owner, null);
      this.say(`Sabotage ruins ${what} in ${FACTIONS[spy.host].name}'s territory.`, spy.owner);
    } else {
      const city = this.citiesOf(spy.host!)[0];
      if (city) {
        if (city.production) city.production.progress = 0;
        city.defenseHp = Math.max(1, city.defenseHp - 3);
        this.say(`Sabotage stalls the yards at ${city.name}.`, spy.owner);
      } else {
        this.say(`The spy finds nothing built to break in ${FACTIONS[spy.host].name}.`, spy.owner);
      }
    }
    this.commit();
    return { ok: true, message: 'Sabotage done.' };
  }

  frameJob(spyId: number, left: FactionId, right: FactionId): ActionResult {
    return this.resolveFrame(spyId, left, right);
  }

  resolveFrame(spyId: number, left: FactionId, right: FactionId, roll = this.rng.next()): ActionResult {
    const spy = this.ownedSpy(spyId);
    if (!spy?.host) return fail('Place the spy before a frame job.');
    if (left === right || left === spy.owner || right === spy.owner) return fail('A frame needs two other factions.');
    const blame = frameBlame(missionCaught(roll, CONFIG.spies.frameCatch));
    if (blame.againstOwner > 0) {
      this.addMemory(spy.owner, left, blame.againstOwner);
      this.addMemory(spy.owner, right, blame.againstOwner);
      this.burnSpy(spy.id, `${FACTIONS[left].name} and ${FACTIONS[right].name} trace the forged evidence to ${FACTIONS[spy.owner].name}.`);
      return { ok: false, message: 'The frame was exposed.' };
    }
    this.addMemory(left, right, blame.betweenTargets);
    const rel = this.relation(left, right);
    const next = downgradeStance(rel.stance);
    if (next === 'war') Object.assign(rel, applyWar({ ...rel, memory: rel.memory }));
    else rel.stance = next;
    if (rel.stance === 'war') {
      rel.research = false;
      rel.exploration = false;
    }
    this.syncAlliances();
    this.say(`${FACTIONS[left].name} and ${FACTIONS[right].name} blame each other. Neither names ${FACTIONS[spy.owner].name}.`, spy.owner);
    this.commit();
    return { ok: true, message: 'The frame landed.' };
  }

  sweepSpies(): { ok: boolean; message: string; removed: number } {
    return this.resolveSweep();
  }

  resolveSweep(roll?: number): { ok: boolean; message: string; removed: number } {
    const host = this.state.whoseTurn;
    const enemies = this.state.spies.filter((spy) => spy.host === host && spy.owner !== host);
    let removed = 0;
    for (const spy of enemies) {
      const chance = roll ?? this.rng.next();
      if (missionCaught(chance, CONFIG.spies.sweepDetect)) {
        this.state.spies = this.state.spies.filter((entry) => entry.id !== spy.id);
        removed += 1;
        this.say(`Counterintelligence roots out a spy from ${FACTIONS[spy.owner].name}.`, host);
      }
    }
    if (!removed) this.say('The sweep finds no foreign spies.', host);
    this.commit();
    return { ok: true, message: removed ? `${removed} spy removed.` : 'No spies found.', removed };
  }

  endTurn(): EndTurnResult {
    if (this.state.winner) return { ok: false, message: 'The game is already over.', autosave: false, aiOrder: [] };
    if (this.state.playerDefeated) return { ok: false, message: 'Your faction is defeated.', autosave: false, aiOrder: [] };
    if (this.state.events.prompt) return { ok: false, message: 'Choose a response to the event first.', autosave: false, aiOrder: [] };
    if (this.state.whoseTurn !== this.state.playerFaction) {
      return { ok: false, message: 'Not your turn.', autosave: false, aiOrder: [] };
    }
    this.finishFactionTurn(this.state.playerFaction);
    this.state.playerTurnsCompleted += 1;
    const autosave = shouldAutosave(this.state.playerTurnsCompleted, this.state.autosaveEnabled);
    const others = (Object.keys(FACTIONS) as FactionId[]).filter((id) => id !== this.state.playerFaction);
    const order = others
      .map((id) => ({ id, roll: this.rng.next() }))
      .sort((a, b) => a.roll - b.roll)
      .map((entry) => entry.id);
    this.state.lastAiOrder = order;
    for (const id of order) {
      if (this.state.winner) break;
      if (!this.unitsOf(id).length && !this.citiesOf(id).length) continue;
      this.beginTurn(id);
      runAi(this);
      this.finishFactionTurn(id);
    }
    if (!this.state.winner) {
      this.state.round += 1;
      this.applyCrisis();
      this.decayGrievances();
      this.tickEvents();
      if (!this.state.playerDefeated) this.beginTurn(this.state.playerFaction);
    }
    recordSocialPresent(this.state);
    this.commit();
    const label = this.calendar().label;
    return { ok: true, message: label, autosave, aiOrder: order };
  }

  private applyCrisis() {
    const round = this.state.round;
    const crisis = crisisTuning(round, this.state.setup.difficulty);
    if (round === crisis.startRound) {
      this.say('The buried ark reactor wakes. The Waking Reactor will scar open ground.');
    }
    const level = crisis.level;
    if (level <= 0) return;
    const damage = crisis.damage;
    const tithe = crisis.tithe;
    for (const faction of Object.values(this.state.factions)) {
      faction.credits = Math.max(0, faction.credits - tithe);
    }
    if (damage > 0) {
      for (const unit of [...this.state.units]) {
        if (unit.aboard != null) continue;
        if (this.state.factions[unit.factionId].techs.includes('sealed-habitats')) continue;
        const tile = this.tile(unit.x, unit.y);
        if (isSea(tile.terrain) || tile.scarred || tile.improvement || this.cityAt(unit.x, unit.y)) continue;
        unit.hp -= damage;
        if (unit.hp <= 0) {
          this.removeUnit(unit);
          this.say(`${unit.name} is lost to the Waking Reactor.`, unit.factionId);
        } else if (unit.factionId === this.state.playerFaction) {
          this.say(`${unit.name} takes ${damage} from the reactor pulse.`, unit.factionId);
        }
      }
    }
    for (const tile of this.state.tiles) {
      if (isSea(tile.terrain) || tile.scarred || tile.improvement || tile.road || this.cityAt(tile.x, tile.y)) continue;
      if ((tile.x * 17 + tile.y * 13 + round) % 23 !== 0) continue;
      if (this.rng.next() < crisis.scarChance) {
        tile.scarred = true;
        this.recordTile(tile, 'the waking reactor scarred this tile and took the air', null, null);
      }
    }
  }

  private enemyFactionAt(attacker: FactionId, x: number, y: number): FactionId | null {
    const unit = this.state.units.find((other) => other.x === x && other.y === y && other.factionId !== attacker);
    if (unit) return unit.factionId;
    const city = this.cityAt(x, y);
    if (city && city.factionId !== attacker) return city.factionId;
    return null;
  }

  private syncAlliances() {
    this.state.alliances = this.state.relations
      .filter((rel) => rel.stance === 'alliance')
      .map((rel) => [rel.a, rel.b]);
  }

  private applyProposal(rel: Relation, kind: Proposal) {
    if (kind === 'peace' || kind === 'nap' || kind === 'alliance') rel.stance = kind;
    else if (kind === 'research') rel.research = true;
    else rel.exploration = true;
  }

  private accepts(decider: FactionId, other: FactionId, kind: Proposal): boolean {
    const personality = this.state.setup.personalities[decider];
    if (
      (kind === 'peace' || kind === 'nap' || kind === 'alliance') &&
      wantsToFight(personality, this.state.setup.difficulty, this.state.round) &&
      (personality.aggression === 'very-aggressive' ||
        personality.diplomacy === 'alone' ||
        this.state.setup.difficulty === 'hard' ||
        this.state.setup.difficulty === 'brutal')
    ) {
      return false;
    }
    const chance = acceptanceChance({
      kind,
      diplomacy: personality.diplomacy,
      aggression: personality.aggression,
      memory: this.relation(decider, other).memory,
      axisMatches: axisOverlap(this.state.factions[decider].axes, this.state.factions[other].axes),
    });
    return this.rng.next() < chance;
  }

  private offerTouches(offer: { from: FactionId; to: FactionId }, a: FactionId, b: FactionId): boolean {
    return (offer.from === a && offer.to === b) || (offer.from === b && offer.to === a);
  }

  private ownedSpy(spyId: number) {
    return this.state.spies.find((spy) => spy.id === spyId && spy.owner === this.state.whoseTurn) ?? null;
  }

  private burnSpy(spyId: number, message: string) {
    const spy = this.state.spies.find((entry) => entry.id === spyId);
    if (!spy) return;
    if (spy.host) this.addMemory(spy.owner, spy.host, CONFIG.spies.caughtMemory);
    this.state.spies = this.state.spies.filter((entry) => entry.id !== spyId);
    this.say(message, spy.owner);
    this.commit();
  }

  private addMemory(a: FactionId, b: FactionId, amount: number) {
    const rel = this.relation(a, b);
    rel.memory = Math.min(100, rel.memory + amount);
  }

  private beginTurn(factionId: FactionId) {
    this.state.whoseTurn = factionId;
    const faction = this.state.factions[factionId];
    if (faction.stabilityTurns > 0) faction.stabilityTurns -= 1;
    for (const unit of [...this.unitsOf(factionId)]) {
      if (unit.aboard != null) {
        unit.movesLeft = 0;
        continue;
      }
      if (unit.terraform) {
        unit.terraform.turnsLeft -= 1;
        if (unit.terraform.turnsLeft <= 0) this.completeTerraform(unit);
        else unit.movesLeft = 0;
      } else {
        unit.movesLeft = unit.maxMoves;
      }
    }
    for (const unit of this.unitsOf(factionId)) {
      let heal = 0;
      if (this.cityAt(unit.x, unit.y)?.factionId === factionId) heal += CONFIG.techBonuses.cityHeal;
      heal += healFromTechs(faction.techs);
      if (heal > 0) unit.hp = Math.min(unit.maxHp, unit.hp + heal);
    }
    this.applyDust(factionId);
    this.revealFaction(factionId);
    if (faction.isHuman) this.say(`${formatCalendar(this.state.round)}. Your orders.`, factionId);
    else this.say(`${FACTIONS[factionId].name} acts.`, factionId);
  }

  private finishFactionTurn(factionId: FactionId) {
    const previous = this.state.whoseTurn;
    this.state.whoseTurn = factionId;
    this.resolveEconomy(factionId);
    this.runPatrols(factionId);
    this.applyExposure(factionId);
    this.state.whoseTurn = previous;
    this.checkVictory();
  }

  private resolveEconomy(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    let research = 0;
    for (const city of [...this.citiesOf(factionId)]) {
      const report = this.cityReport(city.id);
      if (!report) continue;
      research += report.yields.research;
      faction.energy += report.yields.energy;
      if (city.production) {
        city.production.progress += report.yields.minerals;
        let guard = 0;
        while (city.production && city.production.progress >= city.production.cost && guard++ < 4) {
          const design = this.findDesign(factionId, city.production.designId);
          if (!design) {
            faction.minerals += city.production.progress;
            city.production = null;
            break;
          }
          const leftover: number = city.production.progress - city.production.cost;
          const port = design.domain === 'sea' ? this.nearestSea(city.x, city.y, 8) : null;
          this.spawn(factionId, design, port?.x ?? city.x, port?.y ?? city.y, false);
          this.say(`${city.name} completes ${design.name}.`, factionId);
          if (faction.isHuman) {
            city.production.progress = leftover;
            city.production.cost = design.cost;
            continue;
          }
          const nextId = chooseDesign(this, factionId);
          const next = nextId ? this.findDesign(factionId, nextId) : undefined;
          if (!next) {
            faction.minerals += Math.max(0, leftover);
            city.production = null;
            break;
          }
          city.production = { designId: next.id, progress: Math.max(0, leftover), cost: next.cost };
        }
      } else {
        faction.minerals += report.yields.minerals;
      }
      const surplus = report.yields.nutrients - report.need;
      if (surplus >= 0) {
        city.starveTurns = 0;
        city.nutrientStore += surplus;
        faction.nutrients += surplus;
        if (city.nutrientStore >= CONFIG.city.growthThreshold && city.population < CONFIG.city.maxPopulation) {
          city.nutrientStore -= CONFIG.city.growthThreshold;
          city.population += 1;
          this.say(`${city.name} grows to size ${city.population}.`, factionId);
        }
      } else {
        city.nutrientStore = Math.max(0, city.nutrientStore + surplus);
        city.starveTurns += 1;
        if (city.starveTurns >= CONFIG.city.starveTurns && city.population > 1) {
          city.population -= 1;
          city.starveTurns = 0;
          this.say(`${city.name} goes hungry and shrinks.`, factionId);
        }
      }
      faction.credits += report.credits;
    }
    this.payUpkeep(factionId);
    let shared = 0;
    for (const other of Object.keys(this.state.factions) as FactionId[]) {
      if (other === factionId) continue;
      if (sharesResearch(this.relation(factionId, other))) {
        shared += Math.floor(this.state.factions[other].lastResearch * CONFIG.diplomacy.researchShare);
      }
    }
    faction.lastResearch = research;
    faction.researchPoints += research + shared;
    this.finishResearchGrants(factionId);
  }

  private finishResearchGrants(factionId: FactionId) {
    this.tryCompleteResearch(factionId);
    this.grantTreatyTechs(factionId);
  }

  private tryCompleteResearch(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    ensureFactionResearch(faction);
    const tech = faction.researching ? techById(faction.researching) : undefined;
    if (!tech || faction.researchPoints < tech.cost) return;
    faction.researchPoints -= tech.cost;
    faction.techs.push(tech.id);
    rememberTech(faction.techOrigins, tech.id, 'research');
    faction.researching = null;
    this.say(`${FACTIONS[factionId].name} discovers ${tech.name}.`, factionId);
    const next = advanceResearchQueue(faction);
    if (next) faction.researching = next;
  }

  private grantTreatyTechs(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    ensureFactionResearch(faction);
    const partners: string[][] = [];
    for (const other of Object.keys(this.state.factions) as FactionId[]) {
      if (other === factionId) continue;
      if (sharesResearch(this.relation(factionId, other))) partners.push([...this.state.factions[other].techs]);
    }
    if (!partners.length) return;
    for (const id of treatyTechGrants(faction.techs, partners)) {
      const tech = techById(id);
      if (!tech) continue;
      faction.techs.push(id);
      rememberTech(faction.techOrigins, id, 'treaty');
      if (faction.researching === id) faction.researching = null;
      this.say(`A research treaty shares ${tech.name}.`, factionId);
    }
    const next = advanceResearchQueue(faction);
    if (!faction.researching && next) faction.researching = next;
  }

  private applyExposure(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    const sealed = hasSealedHabitats(faction.techs);
    const damage = exposureDamage(this.state.setup.difficulty);
    for (const unit of [...this.unitsOf(factionId)]) {
      if (unit.aboard != null) continue;
      const tile = this.tile(unit.x, unit.y);
      const outcome = exposureOutcome(unit.hp, isExposed(tile.terrain), sealed, damage);
      if (outcome.destroyed) {
        this.removeUnit(unit);
        this.say(`${unit.name} is destroyed by the harsh ground.`, factionId);
      } else if (outcome.hp !== unit.hp) {
        unit.hp = outcome.hp;
        this.say(`${unit.name} takes ${damage} damage from the harsh ground.`, factionId);
      }
    }
  }

  private runPatrols(factionId: FactionId) {
    for (const unit of [...this.unitsOf(factionId)]) {
      if (!unit.searching || unit.terraform || unit.movesLeft <= 0 || unit.aboard != null) continue;
      const options = [...this.reachable(unit.id).entries()].filter(([, step]) => step.cost > 0);
      if (!options.length) {
        this.rollFind(unit, 0.45);
        continue;
      }
      const unseen = options.filter(([key]) => {
        const [x, y] = key.split(',').map(Number);
        return !this.isExplored(factionId, x, y);
      });
      const pool = unseen.length ? unseen : options;
      const pick = pool[this.rng.int(pool.length)];
      const [x, y] = pick[0].split(',').map(Number);
      unit.x = x;
      unit.y = y;
      unit.movesLeft -= pick[1].cost;
      this.revealAround(unit);
      this.rollFind(unit, 1);
    }
  }

  private rollFind(unit: Unit, scale: number) {
    const tile = this.tile(unit.x, unit.y);
    let chance = (CONFIG.scavenger.chance + unit.searchBonus) * scale;
    if (tile.resource === 'ark-debris') chance += CONFIG.scavenger.debrisBonus;
    if (this.rng.next() > chance) return;
    const entries = Object.entries(CONFIG.scavenger.weights);
    let total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.rng.next() * total;
    let choice = entries[0][0];
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        choice = key;
        break;
      }
    }
    const faction = this.state.factions[unit.factionId];
    if (choice === 'unit') {
      const scout = starterDesigns().find((design) => design.role === 'scout');
      if (scout) this.spawn(unit.factionId, scout, unit.x, unit.y, false);
      this.say(`${unit.name} finds survivors willing to scout.`, unit.factionId);
      return;
    }
    const amount = CONFIG.scavenger.amounts[choice] ?? 0;
    if (choice === 'credits') faction.credits += amount;
    if (choice === 'minerals') faction.minerals += amount;
    if (choice === 'nutrients') faction.nutrients += amount;
    if (choice === 'research') faction.researchPoints += amount;
    this.say(`${unit.name} scavenges ${amount} ${choice}.`, unit.factionId);
  }

  private completeTerraform(unit: Unit) {
    if (!unit.terraform) return;
    const tile = this.tile(unit.x, unit.y);
    const project = unit.terraform.project;
    const previous = tile.improvement;
    const previousTerrain = tile.terrain;
    if (project === 'road') tile.road = true;
    else tile.improvement = project;
    if (project === 'atmosphere') softenTile(tile);
    else if (
      project === 'plant-trees' &&
      (tile.terrain === 'grass' || tile.terrain === 'toxic' || tile.terrain === 'scorched' || tile.terrain === 'dunes' || tile.terrain === 'frozen-plain' || tile.terrain === 'coast')
    ) {
      tile.terrain = 'forest';
    }
    if (project === 'mine') tile.elevation = Math.max(0.36, tile.elevation - 0.05);
    const parts: string[] = [];
    if (project === 'road') parts.push('built a road');
    else if (previous && previous !== project) parts.push(`replaced ${projectNoun(previous)} with ${projectNoun(project)}`);
    else parts.push(`built ${projectNoun(project)}`);
    if (tile.terrain !== previousTerrain) parts.push(`the ground became ${tile.terrain.replace('-', ' ')}`);
    if (project === 'atmosphere') parts.push('the climate softened');
    this.recordTile(tile, parts.join(', '), unit.factionId, unit.name);
    unit.terraform = null;
    unit.movesLeft = unit.maxMoves;
    this.say(`${unit.name} finishes ${projectLabel(project)}.`, unit.factionId);
  }

  private workingOn(tile: Tile): TileSight['working'] {
    const worker = this.state.units.find((unit) => unit.x === tile.x && unit.y === tile.y && unit.terraform && unit.aboard == null);
    if (!worker?.terraform) return null;
    return { project: worker.terraform.project, turnsLeft: worker.terraform.turnsLeft, unitName: worker.name };
  }

  private recordTile(tile: Tile, change: string, factionId: FactionId | null, unitName: string | null) {
    tile.history = appendHistory(tile.history ?? [], {
      round: this.state.round,
      factionId,
      unitName,
      change,
    });
  }

  private workedTiles(city: City): Tile[] {
    const radius = CONFIG.city.workRadius;
    const scored: { tile: Tile; score: number }[] = [];
    for (let y = city.y - radius; y <= city.y + radius; y++) {
      for (let x = city.x - radius; x <= city.x + radius; x++) {
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(x - city.x), Math.abs(y - city.y)) > radius) continue;
        const tile = this.tile(x, y);
        if (isSea(tile.terrain)) continue;
        const yields = tileYield(tile);
        scored.push({ tile, score: yields.minerals * 2 + yields.nutrients + yields.energy + yields.research });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.tile.y - b.tile.y || a.tile.x - b.tile.x);
    return scored.slice(0, city.population).map((entry) => entry.tile);
  }

  private creditIncome(city: City, faction: GameState['factions'][FactionId]): number {
    const base = baseCityCreditIncome(city.population);
    const extra = creditFromTechs(faction.techs);
    const rates = economyRates(faction.isHuman, this.state.setup.difficulty);
    const scaled = base * socialScale(faction, 'credits') * rates.credits + extra;
    return Math.max(0, Math.round(scaled));
  }

  private nearestSea(x: number, y: number, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number; d: number } | null = null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny) || !isSea(this.tile(nx, ny).terrain)) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (!best || d < best.d) best = { x: nx, y: ny, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  private spawn(factionId: FactionId, design: UnitDesign, x: number, y: number, ready: boolean): Unit {
    const unit: Unit = {
      id: this.state.nextUnitId++,
      factionId,
      designId: design.id,
      name: design.name,
      x,
      y,
      hp: design.hp,
      maxHp: design.hp,
      movesLeft: ready ? design.moves : 0,
      maxMoves: design.moves,
      attack: design.attack,
      defense: design.defense,
      vision: design.vision,
      domain: design.domain,
      canFound: design.canFound,
      canTerraform: design.canTerraform,
      searchBonus: design.searchBonus,
      role: design.role,
      searching: false,
      terraform: null,
      transport: design.transport ?? 0,
      cargo: [],
      aboard: null,
    };
    this.state.units.push(unit);
    return unit;
  }

  private removeUnit(unit: Unit) {
    if (unit.cargo.length) {
      const lost = new Set(unit.cargo);
      this.state.units = this.state.units.filter((other) => other.id !== unit.id && !lost.has(other.id));
      return;
    }
    if (unit.aboard != null) {
      const ship = this.unitById(unit.aboard);
      if (ship) ship.cargo = ship.cargo.filter((id) => id !== unit.id);
    }
    this.state.units = this.state.units.filter((other) => other.id !== unit.id);
  }

  private controlled(unitId: number): Unit | null {
    if (this.state.winner) return null;
    const unit = this.unitById(unitId);
    if (!unit || unit.factionId !== this.state.whoseTurn) return null;
    return unit;
  }

  private controlledCity(cityId: number): City | null {
    if (this.state.winner) return null;
    const city = this.state.cities.find((c) => c.id === cityId);
    if (!city || city.factionId !== this.state.whoseTurn) return null;
    return city;
  }

  private designAllowed(techs: readonly string[], design: UnitDesign): boolean {
    const compiled = compileDesign(
      { name: design.name, chassis: design.chassis, weapon: design.weapon, armor: design.armor, specials: design.specials },
      techs,
      design.id,
    );
    return compiled.ok;
  }

  private nextCityName(factionId: FactionId): string {
    const used = new Set(this.citiesOf(factionId).map((city) => city.name));
    const free = FACTIONS[factionId].cityNames.find((name) => !used.has(name));
    return free ?? `${FACTIONS[factionId].name} ${this.state.nextCityId}`;
  }

  private enemiesAt(factionId: FactionId, x: number, y: number): Unit[] {
    return this.state.units.filter((unit) => unit.factionId === factionId && unit.x === x && unit.y === y);
  }

  private canEnter(unit: Unit, tile: Tile): boolean {
    if (unit.domain === 'sea') return isSea(tile.terrain);
    return !isSea(tile.terrain);
  }

  visionOf(unit: Unit): number {
    const bonus = this.state.factions[unit.factionId].techs.includes('sensors') ? 1 : 0;
    const flare = this.flareActive() ? 1 : 0;
    return Math.max(1, unit.vision + bonus - flare);
  }

  private revealAround(unit: Unit) {
    this.reveal(unit.factionId, unit.x, unit.y, this.visionOf(unit));
  }

  private revealFaction(factionId: FactionId) {
    for (const unit of this.unitsOf(factionId)) this.revealAround(unit);
    for (const city of this.citiesOf(factionId)) this.reveal(factionId, city.x, city.y, CONFIG.map.cityVision);
  }

  private reveal(faction: FactionId, cx: number, cy: number, radius: number) {
    const row = this.state.explored[faction];
    const memory = ensureRecall(this.state)[faction];
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > radius) continue;
        const index = y * this.state.width + x;
        row[index] = true;
        const tile = this.state.tiles[index];
        memory[index] = snapshotRecall(
          tile,
          this.cityAt(x, y),
          this.state.units.filter((unit) => unit.x === x && unit.y === y),
        );
      }
    }
    this.noteContact();
  }

  disband(unitId: number): void {
    const unit = this.unitById(unitId);
    if (!unit || unit.factionId !== this.state.whoseTurn) return;
    this.removeUnit(unit);
    this.say(`${unit.name} is disbanded.`, unit.factionId);
    this.noteEliminations();
    this.commit();
  }

  boardableUnits(transportId: number): Unit[] {
    const ship = this.unitById(transportId);
    if (!ship || ship.domain !== 'sea' || ship.transport <= ship.cargo.length) return [];
    return this.unitsOf(ship.factionId).filter(
      (unit) =>
        unit.id !== ship.id &&
        unit.domain === 'land' &&
        unit.aboard == null &&
        !unit.terraform &&
        Math.max(Math.abs(unit.x - ship.x), Math.abs(unit.y - ship.y)) === 1 &&
        !isSea(this.tile(unit.x, unit.y).terrain),
    );
  }

  coastalDrops(transportId: number): { x: number; y: number }[] {
    const ship = this.unitById(transportId);
    if (!ship || ship.domain !== 'sea') return [];
    const drops: { x: number; y: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = ship.x + dx;
        const y = ship.y + dy;
        if (!this.inBounds(x, y)) continue;
        const tile = this.tile(x, y);
        if (isSea(tile.terrain)) continue;
        if (this.state.units.some((unit) => unit.x === x && unit.y === y && unit.factionId !== ship.factionId && unit.aboard == null)) continue;
        const city = this.cityAt(x, y);
        if (city && city.factionId !== ship.factionId) continue;
        drops.push({ x, y });
      }
    }
    return drops;
  }

  loadUnit(transportId: number, passengerId: number): ActionResult {
    const ship = this.controlled(transportId);
    const passenger = this.unitById(passengerId);
    if (!ship || ship.domain !== 'sea') return fail('Only a ship can take units aboard.');
    if (!passenger || passenger.factionId !== ship.factionId || passenger.domain !== 'land') return fail('That unit cannot board.');
    if (passenger.aboard != null || passenger.terraform) return fail('That unit is not free to board.');
    if (ship.cargo.length >= ship.transport) return fail('The ship has no room.');
    if (ship.movesLeft <= 0) return fail('The ship has no move left to take anyone aboard.');
    if (!this.boardableUnits(ship.id).some((unit) => unit.id === passenger.id)) {
      return fail('Loading happens from an adjacent coastal tile.');
    }
    passenger.aboard = ship.id;
    passenger.x = ship.x;
    passenger.y = ship.y;
    passenger.movesLeft = 0;
    passenger.searching = false;
    ship.cargo.push(passenger.id);
    ship.movesLeft -= 1;
    this.say(`${passenger.name} boards ${ship.name}.`, ship.factionId);
    this.commit();
    return { ok: true, message: `${passenger.name} is aboard ${ship.name}.` };
  }

  unloadUnit(transportId: number, passengerId: number, x: number, y: number): ActionResult {
    const ship = this.controlled(transportId);
    const passenger = this.unitById(passengerId);
    if (!ship || !passenger || passenger.aboard !== ship.id) return fail('That unit is not aboard this ship.');
    if (ship.movesLeft <= 0) return fail('The ship cannot unload this turn.');
    if (!this.coastalDrops(ship.id).some((tile) => tile.x === x && tile.y === y)) {
      return fail('Unload onto an adjacent coastal tile.');
    }
    passenger.aboard = null;
    passenger.x = x;
    passenger.y = y;
    passenger.movesLeft = 0;
    ship.cargo = ship.cargo.filter((id) => id !== passenger.id);
    ship.movesLeft -= 1;
    this.revealAround(passenger);
    this.say(`${passenger.name} comes ashore from ${ship.name}.`, ship.factionId);
    this.commit();
    return { ok: true, message: `${passenger.name} is ashore.` };
  }

  chooseEvent(choiceId: string): ActionResult {
    const prompt = this.state.events.prompt;
    if (!prompt) return fail('Nothing is asking for a decision.');
    if (this.state.whoseTurn !== this.state.playerFaction) return fail('Not your turn.');
    if (!prompt.choices.some((choice) => choice.id === choiceId)) return fail('That is not one of the choices.');
    const faction = this.state.factions[this.state.playerFaction];
    if (choiceId === 'shield' && faction.energy < CONFIG.events.flareShieldEnergy) {
      return fail(`Powering down costs ${CONFIG.events.flareShieldEnergy} energy.`);
    }
    if (choiceId === 'shore' && faction.minerals < CONFIG.events.seismicMinerals) {
      return fail(`Shoring the walls costs ${CONFIG.events.seismicMinerals} minerals.`);
    }
    this.state.events.prompt = null;
    this.resolveEvent(prompt.kind, choiceId, prompt.subject);
    this.commit();
    return { ok: true, message: 'The faction answers.' };
  }

  /** One faction, played by the AI. Used by the headless expansion check. */
  runFactionAi(factionId: FactionId): void {
    const was = this.state.factions[factionId].isHuman;
    this.state.factions[factionId].isHuman = false;
    this.beginTurn(factionId);
    runAi(this);
    this.state.factions[factionId].isHuman = was;
    this.commit();
  }

  /** A full round in which every surviving faction is played by the AI. */
  simulateAllAiRound(): void {
    if (this.state.winner) return;
    const ids = (Object.keys(FACTIONS) as FactionId[]).filter((id) => this.unitsOf(id).length || this.citiesOf(id).length);
    const order = ids
      .map((id) => ({ id, roll: this.rng.next() }))
      .sort((a, b) => a.roll - b.roll)
      .map((entry) => entry.id);
    for (const id of order) {
      if (this.state.winner) break;
      if (!this.unitsOf(id).length && !this.citiesOf(id).length) continue;
      const was = this.state.factions[id].isHuman;
      this.state.factions[id].isHuman = false;
      this.beginTurn(id);
      runAi(this);
      this.finishFactionTurn(id);
      this.state.factions[id].isHuman = was;
    }
    if (!this.state.winner) {
      this.state.round += 1;
      this.applyCrisis();
      this.decayGrievances();
      if (this.state.setup.randomEvents) this.tickEvents();
    }
    this.commit();
  }

  private checkVictory() {
    this.noteEliminations();
    const stillFounding = this.state.units.filter((unit) => unit.canFound).map((unit) => unit.factionId);
    const winner = evaluateVictory(
      this.state.cities.map((city) => city.factionId),
      this.state.alliances,
      this.state.setup.alliedVictory,
      stillFounding,
    );
    if (!winner) return;
    this.state.winner = winner;
    const names = winner.factions.map((id) => FACTIONS[id].name).join(', ');
    this.say(winner.kind === 'alliance' ? `Allied victory: ${names}.` : `${names} holds every city.`);
  }

  private payUpkeep(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    let energyUpkeep = 0;
    const improved = new Set<string>();
    for (const city of this.citiesOf(factionId)) {
      energyUpkeep += CONFIG.economy.cityEnergyUpkeep;
      const report = this.cityReport(city.id);
      for (const worked of report?.worked ?? []) {
        if (this.tile(worked.x, worked.y).improvement) improved.add(`${worked.x},${worked.y}`);
      }
    }
    energyUpkeep += improved.size * CONFIG.economy.improvementEnergy;
    faction.energy = Math.max(0, faction.energy - energyUpkeep);
    const units = [...this.unitsOf(factionId)];
    if (faction.minerals > 0) faction.minerals = Math.max(0, faction.minerals - units.length * CONFIG.upkeep.minerals);
    if (faction.nutrients > 0) faction.nutrients = Math.max(0, faction.nutrients - units.length * CONFIG.upkeep.nutrients);
    let creditCost = units.reduce((sum, unit) => sum + unitUpkeep(unit.role), 0);
    const pods = units.filter((unit) => unit.canFound).sort((a, b) => b.id - a.id);
    const keep = this.citiesOf(factionId).length === 0 ? 1 : 0;
    let podCount = pods.length;
    for (const pod of pods) {
      if (faction.credits >= creditCost) break;
      if (podCount <= keep) break;
      creditCost -= unitUpkeep(pod.role);
      podCount -= 1;
      this.removeUnit(pod);
      this.say(`${pod.name} is disbanded. Upkeep cannot cover another colony pod.`, factionId);
    }
    faction.credits = Math.max(0, faction.credits - Math.max(0, creditCost));
  }

  private decayGrievances() {
    for (const rel of this.state.relations) {
      rel.memory = Math.max(0, rel.memory - CONFIG.diplomacy.memoryDecay);
    }
  }

  private flareActive(): boolean {
    return this.state.events.solarFlareUntil >= this.state.round;
  }

  private canPay(factionId: FactionId, bundle: TradeBundle): boolean {
    const faction = this.state.factions[factionId];
    if (faction.credits < bundle.credits || faction.minerals < bundle.minerals) return false;
    if (faction.nutrients < bundle.nutrients || faction.energy < bundle.energy) return false;
    if (bundle.tech && !faction.techs.includes(bundle.tech)) return false;
    return bundle.credits + bundle.minerals + bundle.nutrients + bundle.energy > 0 || !!bundle.tech;
  }

  private transferTrade(from: FactionId, to: FactionId, give: TradeBundle, want: TradeBundle) {
    const payer = this.state.factions[from];
    const receiver = this.state.factions[to];
    payer.credits -= give.credits;
    payer.minerals -= give.minerals;
    payer.nutrients -= give.nutrients;
    payer.energy -= give.energy;
    receiver.credits += give.credits;
    receiver.minerals += give.minerals;
    receiver.nutrients += give.nutrients;
    receiver.energy += give.energy;
    receiver.credits -= want.credits;
    receiver.minerals -= want.minerals;
    receiver.nutrients -= want.nutrients;
    receiver.energy -= want.energy;
    payer.credits += want.credits;
    payer.minerals += want.minerals;
    payer.nutrients += want.nutrients;
    payer.energy += want.energy;
    if (give.tech && !receiver.techs.includes(give.tech)) receiver.techs.push(give.tech);
    if (want.tech && !payer.techs.includes(want.tech)) payer.techs.push(want.tech);
  }

  private noteEliminations() {
    for (const id of Object.keys(FACTIONS) as FactionId[]) {
      if (this.state.eliminated.includes(id)) continue;
      if (!factionEliminated(this.citiesOf(id).length, this.unitsOf(id))) continue;
      this.state.eliminated.push(id);
      this.say(`${FACTIONS[id].name} is eliminated. No cities remain, and no colony pod can found another.`);
      if (id === this.state.playerFaction && this.state.factions[id].isHuman) this.state.playerDefeated = true;
    }
  }

  private applyDust(factionId: FactionId) {
    if (this.state.events.dustUntil < this.state.round) return;
    const human = this.state.factions[factionId].isHuman;
    const push = human && !this.state.events.dustShelter;
    const cautious = !human && this.state.setup.personalities[factionId].risk === 'cautious';
    for (const unit of [...this.unitsOf(factionId)]) {
      if (unit.aboard != null || unit.terraform) continue;
      const home = this.cityAt(unit.x, unit.y)?.factionId === factionId;
      if ((human && this.state.events.dustShelter && home) || (cautious && home)) continue;
      if (push || (!human && !cautious)) {
        unit.hp -= human ? CONFIG.events.dustPushDamage : 1;
        if (unit.hp <= 0) {
          this.removeUnit(unit);
          this.say(`${unit.name} is lost in the dust.`, factionId);
        }
        continue;
      }
      unit.movesLeft = Math.max(0, unit.movesLeft - 1);
    }
  }

  private tickEvents() {
    if (!this.state.setup.randomEvents || this.state.winner) return;
    const events = this.state.events;
    if (events.prompt) return;
    if (events.pending && this.state.round >= events.pending.fireRound) {
      const kind = events.pending.kind;
      events.pending = null;
      this.openEvent(kind, true);
      return;
    }
    if (events.pending) return;
    if (this.state.round < events.nextRollRound) return;
    if (this.rng.next() > CONFIG.events.chance) {
      events.nextRollRound = this.state.round + 1 + this.rng.int(4);
      return;
    }
    const kind = EVENT_KINDS[this.rng.int(EVENT_KINDS.length)];
    const gap = CONFIG.events.gapMin + this.rng.int(Math.max(1, CONFIG.events.gapMax - CONFIG.events.gapMin + 1));
    if (this.rng.next() < CONFIG.events.warningChance) {
      const span = CONFIG.events.warningLeadMax - CONFIG.events.warningLeadMin + 1;
      const lead = CONFIG.events.warningLeadMin + this.rng.int(span);
      events.pending = { id: events.nextId++, kind, fireRound: this.state.round + lead };
      events.nextRollRound = events.pending.fireRound + gap;
      this.say(eventWarningText(kind));
      return;
    }
    events.nextRollRound = this.state.round + gap;
    this.openEvent(kind, false);
  }

  private openEvent(kind: import('./types').EventKind, warned: boolean) {
    const player = this.state.playerFaction;
    const human = this.state.factions[player].isHuman && !this.state.playerDefeated;
    if (kind === 'betrayal') {
      const rel = this.pickBetrayal();
      if (!rel) {
        this.say('The rumor of betrayal fades before anyone breaks an oath.');
        return;
      }
      const involvesPlayer = rel.a === player || rel.b === player;
      if (human && involvesPlayer) {
        const other = rel.a === player ? rel.b : rel.a;
        const prompt = eventPromptFor(kind, this.state.events.nextId++);
        prompt.subject = other;
        prompt.text = `${FACTIONS[other].name} is about to break with you.`;
        this.state.events.prompt = prompt;
        this.say(prompt.text);
        return;
      }
      Object.assign(rel, applyWar(rel));
      this.syncAlliances();
      this.say(`${FACTIONS[rel.a].name} betrays ${FACTIONS[rel.b].name}. The standing falls to war.`);
      return;
    }
    if (!human) {
      this.resolveEvent(kind, kind === 'wreckage' ? 'supplies' : kind === 'solar-flare' ? 'ride' : kind === 'dust-storm' ? 'push' : 'brace');
      return;
    }
    if (kind === 'wreckage' && this.rng.next() > 0.6) {
      const ids = (Object.keys(FACTIONS) as FactionId[]).filter((id) => this.citiesOf(id).length || this.unitsOf(id).length);
      const who = ids[this.rng.int(ids.length)] ?? player;
      this.grantWreckage(who, 'supplies');
      return;
    }
    const prompt = eventPromptFor(kind, this.state.events.nextId++);
    this.state.events.prompt = prompt;
    this.say(warned ? `The warning comes due. ${prompt.text}` : prompt.text);
  }

  private pickBetrayal(): Relation | null {
    const pacts = this.state.relations.filter((rel) => rel.stance === 'nap' || rel.stance === 'alliance');
    const pool = pacts.length ? pacts : this.state.relations.filter((rel) => rel.stance === 'peace');
    if (!pool.length) return null;
    return pool[this.rng.int(pool.length)] ?? null;
  }

  private resolveEvent(kind: import('./types').EventKind, choice: string, subject?: FactionId) {
    const player = this.state.playerFaction;
    if (kind === 'solar-flare') {
      const turns = choice === 'shield' ? CONFIG.events.flareShortTurns : CONFIG.events.flareTurns;
      if (choice === 'shield') {
        this.state.factions[player].energy = Math.max(0, this.state.factions[player].energy - CONFIG.events.flareShieldEnergy);
      }
      this.state.events.solarFlareUntil = this.state.round + turns - 1;
      this.say(choice === 'shield' ? 'Sensors go dark. The flare passes quickly.' : 'The flare scrambles comms across the band.');
      return;
    }
    if (kind === 'wreckage') {
      this.grantWreckage(player, choice);
      return;
    }
    if (kind === 'betrayal' && subject) {
      const rel = this.relation(player, subject);
      if (choice === 'plead') {
        rel.stance = 'peace';
        rel.research = false;
        rel.exploration = false;
        rel.memory = Math.min(100, rel.memory + 6);
        this.syncAlliances();
        this.say(`${FACTIONS[player].name} sues for peace with ${FACTIONS[subject].name}. The guns stop.`);
      } else {
        Object.assign(rel, applyWar(rel));
        this.syncAlliances();
        this.state.offers = this.state.offers.filter((offer) => !this.offerTouches(offer, player, subject));
        this.say(`${FACTIONS[player].name} and ${FACTIONS[subject].name} are at war.`);
      }
      return;
    }
    if (kind === 'dust-storm') {
      this.state.events.dustShelter = choice === 'shelter';
      this.state.events.dustUntil = this.state.round + CONFIG.events.dustTurns - 1;
      this.say(choice === 'shelter' ? 'Dust closes in. Crews shelter in the cities.' : 'Crews push through the dust and take the wear.');
      this.applyDust(player);
      return;
    }
    if (kind === 'seismic') {
      const heavy = choice !== 'shore';
      if (!heavy) this.state.factions[player].minerals = Math.max(0, this.state.factions[player].minerals - CONFIG.events.seismicMinerals);
      this.shakeCity(player, heavy);
    }
  }

  private grantWreckage(factionId: FactionId, choice: string) {
    const faction = this.state.factions[factionId];
    if (choice === 'study') {
      faction.researchPoints += CONFIG.events.wreckageResearch;
      this.say(`${FACTIONS[factionId].name} studies the wreck and gains ${CONFIG.events.wreckageResearch} research.`, factionId);
      return;
    }
    if (choice === 'crew') {
      const scout = starterDesigns().find((design) => design.role === 'scout');
      const home = this.citiesOf(factionId)[0] ?? this.unitsOf(factionId)[0];
      if (scout && home) this.spawn(factionId, scout, home.x, home.y, false);
      this.say(`${FACTIONS[factionId].name} recovers a crew from the wreck.`, factionId);
      return;
    }
    faction.credits += CONFIG.events.wreckageCredits;
    faction.minerals += CONFIG.events.wreckageMinerals;
    this.say(
      `${FACTIONS[factionId].name} salvages ${CONFIG.events.wreckageCredits} credits and ${CONFIG.events.wreckageMinerals} minerals.`,
      factionId,
    );
  }

  private shakeCity(factionId: FactionId, heavy: boolean) {
    const cities = this.citiesOf(factionId);
    if (!cities.length) {
      this.say('The quake rolls through empty ground.', factionId);
      return;
    }
    const city = cities[this.rng.int(cities.length)] ?? cities[0];
    const loss = heavy ? CONFIG.events.seismicDamage : CONFIG.events.seismicLightDamage;
    city.defenseHp = Math.max(1, city.defenseHp - loss);
    if (heavy && city.population > 1) city.population -= 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy || !this.inBounds(city.x + dx, city.y + dy)) continue;
        const tile = this.tile(city.x + dx, city.y + dy);
        if (isSea(tile.terrain) || tile.terrain === 'mountain') continue;
        const before = tile.terrain;
        tile.terrain = 'rocky';
        if (before !== 'rocky') {
          this.recordTile(tile, `a seismic shift turned ${before.replace('-', ' ')} into rocky ground`, null, null);
        }
        this.say(`${city.name} is shaken. The ground beside it splits into rock.`, factionId);
        return;
      }
    }
    this.say(`${city.name} is shaken by a seismic shift.`, factionId);
  }

  private say(text: string, factionId?: FactionId) {
    this.state.log.push({ round: this.state.round, text, factionId });
    if (this.state.log.length > CONFIG.logLimit) {
      this.state.log.splice(0, this.state.log.length - CONFIG.logLimit);
    }
  }

  private commit() {
    this.state.rngState = this.rng.getState();
    this.revision += 1;
  }
}


function fail(message: string): ActionResult {
  return { ok: false, message };
}

function add(a: Yields, b: Yields): Yields {
  return {
    minerals: a.minerals + b.minerals,
    nutrients: a.nutrients + b.nutrients,
    energy: a.energy + b.energy,
    research: a.research + b.research,
  };
}

export function projectLabel(project: ImprovementId): string {
  switch (project) {
    case 'plant-trees':
      return 'planting trees';
    case 'farm':
      return 'a farm';
    case 'mine':
      return 'a mine';
    case 'solar':
      return 'solar panels';
    case 'road':
      return 'a road';
    case 'atmosphere':
      return 'atmosphere work';
    default:
      return 'terraforming';
  }
}

export const PROJECTS: { id: ImprovementId; label: string; detail: string }[] = [
  { id: 'farm', label: 'Farm', detail: '+nutrients' },
  { id: 'plant-trees', label: 'Plant trees', detail: '+nutrients, may become forest' },
  { id: 'mine', label: 'Mine', detail: '+minerals' },
  { id: 'solar', label: 'Solar panels', detail: '+energy' },
  { id: 'road', label: 'Road', detail: 'Easier travel over rough ground' },
  { id: 'atmosphere', label: 'Atmosphere', detail: 'Softens a harsh climate and raises its yields' },
];
