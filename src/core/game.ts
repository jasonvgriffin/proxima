import { CONFIG } from '../config';
import { runAi } from './ai';
import { crisisBandDamage, crisisCreditTithe, crisisLevel, crisisYieldFactor } from './crisis';
import {
  acceptanceChance,
  applyWar,
  axisOverlap,
  blocksAttack,
  canOfferTreaty,
  canSetStance,
  downgradeStance,
  findRelation,
  initialRelations,
  proposalLabel,
  sharesMaps,
  sharesResearch,
} from './diplomacy';
import { frameBlame, missionCaught } from './spies';
import { socialScale, tileYield, withTechFlats, type Yields } from './economy';
import { FACTIONS, defaultAxes, defaultPersonalities, socialOption } from './factions';
import { generateMap } from './mapgen';
import { blockedKeys, reachable as pathReachable } from './path';
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
  hasSealedHabitats,
  isSea,
  outsideBandOutcome,
  projectAllowed,
  rushBuyCost,
  shouldAutosave,
  terraformFee,
  terraformTurns,
  terrainDefenseMod,
  tileIsLivable,
  winnerHpLoss,
} from './rules';
import { formerTechLevel, techAvailable, techById, startingTechs } from './tech';
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
  Unit,
  UnitDesign,
} from './types';

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
  private rng: Rng;

  constructor(state: GameState) {
    this.state = state;
    this.rng = makeRng(state.seed || 1);
    this.rng.setState(state.rngState || 1);
  }

  static newGame(opts: NewGameOptions): Game {
    const seed = opts.seed >>> 0 || 1;
    const rng = makeRng(seed);
    const ids = Object.keys(FACTIONS) as FactionId[];
    const map = generateMap(rng, ids, seed);
    const personalities = opts.personalities ?? defaultPersonalities();
    const setup: GameSetup = {
      difficulty: opts.difficulty ?? 'normal',
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
        researchPoints: 0,
        credits: CONFIG.starting.credits,
        minerals: CONFIG.starting.minerals,
        nutrients: CONFIG.starting.nutrients,
        energy: CONFIG.starting.energy,
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
      log: [],
      winner: null,
      alliances: [],
      relations: initialRelations(ids),
      spies: [],
      offers: [],
      nextSpyId: 1,
      nextOfferId: 1,
      axisHistory: [{ round: 1, axes: { ...factions[opts.player].axes } }],
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
      game.say('Random events are switched on. This test build saves that choice and does not fire events yet.');
    }
    game.say(`${FACTIONS[opts.player].name} wakes in the twilight band. Found a city, then set a terraformer to work.`);
    game.beginTurn(opts.player);
    game.commit();
    return game;
  }

  static fromState(state: GameState): Game {
    const copy = JSON.parse(JSON.stringify(state)) as GameState;
    return new Game(copy);
  }

  serialize(): GameState {
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

  reachable(unitId: number): Map<string, { cost: number; path: { x: number; y: number }[] }> {
    const unit = this.unitById(unitId);
    if (!unit || unit.terraform || unit.movesLeft <= 0) return new Map();
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
      worked.reduce((sum, tile) => add(sum, tileYield(tile)), {
        minerals: CONFIG.city.baseMinerals,
        nutrients: CONFIG.city.baseNutrients,
        energy: CONFIG.city.baseEnergy,
        research: CONFIG.city.baseResearch,
      } as Yields),
      faction.techs,
    );
    const crisis = crisisYieldFactor(crisisLevel(this.state.round));
    const yields: Yields = {
      minerals: Math.max(0, Math.round(raw.minerals * socialScale(faction, 'minerals') * this.aiYield(faction) * crisis)),
      nutrients: Math.max(0, Math.round(raw.nutrients * socialScale(faction, 'nutrients') * this.aiYield(faction) * crisis)),
      energy: Math.max(0, Math.round(raw.energy * socialScale(faction, 'energy') * this.aiYield(faction) * crisis)),
      research: Math.max(0, Math.round(raw.research * socialScale(faction, 'research') * this.aiYield(faction) * crisis)),
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
    if (unit.terraform) return fail('This terraformer has to finish the tile first.');
    if (unit.movesLeft <= 0) return fail('No movement left this turn.');
    const step = this.reachable(unitId).get(`${x},${y}`);
    if (!step || step.cost <= 0) return fail('That tile is out of reach.');
    unit.x = x;
    unit.y = y;
    unit.movesLeft -= step.cost;
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
      livable: tile.livable,
      inBand: tile.zone === 'twilight',
      hasSealed: hasSealedHabitats(faction.techs),
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
    if (faction.credits < fee) return fail(`Terraforming costs ${fee} credits.`);
    const turns = terraformTurns(project, formerTechLevel(faction.techs));
    faction.credits -= fee;
    unit.terraform = { project, turnsLeft: turns, total: turns };
    unit.movesLeft = 0;
    this.say(`${unit.name} begins ${projectLabel(project)} (${turns} turns, ${fee} credits).`, unit.factionId);
    this.commit();
    return { ok: true, message: `${projectLabel(project)} started. ${turns} turns, ${fee} credits.` };
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
      navalBombardment: unit.domain === 'sea' && !!enemyCity,
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
    const cost = rushBuyCost(remaining);
    if (cost <= 0) return fail('The build is already finished.');
    const faction = this.state.factions[city.factionId];
    if (faction.credits < cost) return fail(`Rush-buy costs ${cost} credits.`);
    const design = this.findDesign(city.factionId, city.production.designId);
    if (!design) return fail('The design is gone.');
    faction.credits -= cost;
    city.production.progress = 0;
    this.spawn(city.factionId, design, city.x, city.y, true);
    this.say(`${city.name} rush-buys ${design.name} for ${cost} credits.`, city.factionId);
    this.commit();
    return { ok: true, message: `Rushed ${design.name} for ${cost} credits.` };
  }

  chooseResearch(techId: string): ActionResult {
    const faction = this.state.factions[this.state.whoseTurn];
    const tech = techById(techId);
    if (!tech) return fail('Unknown technology.');
    if (faction.techs.includes(techId)) return fail('Already known.');
    if (!techAvailable(tech, faction.techs)) return fail('Requirements missing.');
    faction.researching = techId;
    this.tryCompleteResearch(faction.id);
    this.commit();
    return { ok: true, message: `Researching ${tech.name}.` };
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

  acceptOffer(offerId: number): ActionResult {
    if (this.state.whoseTurn !== this.state.playerFaction) return fail('Not your turn.');
    const offer = this.state.offers.find((entry) => entry.id === offerId && entry.to === this.state.playerFaction);
    if (!offer) return fail('That offer is gone.');
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
    this.say(`Stolen from ${FACTIONS[spy.host].name}: ${techId}.`, spy.owner);
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
      this.beginTurn(this.state.playerFaction);
    }
    this.commit();
    const label = this.calendar().label;
    return { ok: true, message: label, autosave, aiOrder: order };
  }

  private applyCrisis() {
    const round = this.state.round;
    if (round === CONFIG.crisis.startRound) {
      this.say('The buried ark reactor wakes under the terminator. The Waking Reactor will fray the twilight band.');
    }
    const level = crisisLevel(round);
    if (level <= 0) return;
    const damage = crisisBandDamage(level);
    const tithe = crisisCreditTithe(level);
    for (const faction of Object.values(this.state.factions)) {
      faction.credits = Math.max(0, faction.credits - tithe);
    }
    if (damage > 0) {
      for (const unit of [...this.state.units]) {
        if (this.state.factions[unit.factionId].techs.includes('sealed-habitats')) continue;
        const tile = this.tile(unit.x, unit.y);
        if (tile.zone !== 'twilight' || tile.scarred || tile.improvement || this.cityAt(unit.x, unit.y)) continue;
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
      if (tile.x !== CONFIG.map.bandStart && tile.x !== CONFIG.map.bandEnd) continue;
      if (tile.scarred || tile.improvement || tile.road || this.cityAt(tile.x, tile.y)) continue;
      if (this.rng.next() < CONFIG.crisis.scarChance * level) {
        tile.scarred = true;
        tile.livable = false;
      }
    }
    this.say(`The Waking Reactor pulses (strength ${Math.round(level * 100)}%). Anchor tiles with terraforming.`);
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
      if (faction.techs.includes('medicine')) heal += CONFIG.techBonuses.medicineHeal;
      if (heal > 0) unit.hp = Math.min(unit.maxHp, unit.hp + heal);
    }
    this.revealFaction(factionId);
    if (faction.isHuman) this.say(`${formatCalendar(this.state.round)}. Your orders.`, factionId);
    else this.say(`${FACTIONS[factionId].name} acts.`, factionId);
  }

  private finishFactionTurn(factionId: FactionId) {
    const previous = this.state.whoseTurn;
    this.state.whoseTurn = factionId;
    this.resolveEconomy(factionId);
    this.runPatrols(factionId);
    this.applyOutsideDamage(factionId);
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
        while (city.production && city.production.progress >= city.production.cost && guard++ < 3) {
          const design = this.findDesign(factionId, city.production.designId);
          if (!design) {
            city.production = null;
            break;
          }
          city.production.progress -= city.production.cost;
          this.spawn(factionId, design, city.x, city.y, false);
          this.say(`${city.name} completes ${design.name}.`, factionId);
          city.production.cost = design.cost;
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
    let shared = 0;
    for (const other of Object.keys(this.state.factions) as FactionId[]) {
      if (other === factionId) continue;
      if (sharesResearch(this.relation(factionId, other))) {
        shared += Math.floor(this.state.factions[other].lastResearch * CONFIG.diplomacy.researchShare);
      }
    }
    faction.lastResearch = research;
    faction.researchPoints += research + shared;
    this.tryCompleteResearch(factionId);
  }

  private tryCompleteResearch(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    const tech = faction.researching ? techById(faction.researching) : undefined;
    if (!tech || faction.researchPoints < tech.cost) return;
    faction.researchPoints -= tech.cost;
    faction.techs.push(tech.id);
    faction.researching = null;
    this.say(`${FACTIONS[factionId].name} discovers ${tech.name}.`, factionId);
  }

  private applyOutsideDamage(factionId: FactionId) {
    const faction = this.state.factions[factionId];
    const sealed = hasSealedHabitats(faction.techs);
    for (const unit of [...this.unitsOf(factionId)]) {
      const tile = this.tile(unit.x, unit.y);
      const outcome = outsideBandOutcome(unit.hp, tileIsLivable(tile), sealed);
      if (outcome.destroyed) {
        this.removeUnit(unit);
        this.say(`${unit.name} is destroyed outside the livable zone.`, factionId);
      } else if (outcome.hp !== unit.hp) {
        unit.hp = outcome.hp;
        this.say(`${unit.name} takes ${CONFIG.outsideBand.damagePerTurn} damage outside the twilight band.`, factionId);
      }
    }
  }

  private runPatrols(factionId: FactionId) {
    for (const unit of [...this.unitsOf(factionId)]) {
      if (!unit.searching || unit.terraform || unit.movesLeft <= 0) continue;
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
    if (project === 'road') tile.road = true;
    else tile.improvement = project;
    if (
      project === 'plant-trees' &&
      (tile.terrain === 'grass' || tile.terrain === 'toxic' || tile.terrain === 'scorched' || tile.terrain === 'dunes' || tile.terrain === 'frozen-plain')
    ) {
      tile.terrain = 'forest';
    }
    tile.livable = true;
    unit.terraform = null;
    unit.movesLeft = unit.maxMoves;
    this.say(`${unit.name} finishes ${projectLabel(project)}. The tile joins the livable zone.`, unit.factionId);
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
    const extra = faction.techs.includes('governance') ? CONFIG.techBonuses.governanceCredits : 0;
    const scaled = base * socialScale(faction, 'credits') * this.aiYield(faction) + extra;
    return Math.max(0, Math.round(scaled));
  }

  private aiYield(faction: GameState['factions'][FactionId]): number {
    if (faction.isHuman) return 1;
    return CONFIG.ai.yieldMultiplier[this.state.setup.difficulty] ?? 1;
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
    };
    this.state.units.push(unit);
    return unit;
  }

  private removeUnit(unit: Unit) {
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
    return unit.vision + bonus;
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
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= radius) row[y * this.state.width + x] = true;
      }
    }
  }

  private checkVictory() {
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

  private say(text: string, factionId?: FactionId) {
    this.state.log.push({ round: this.state.round, text, factionId });
    if (this.state.log.length > CONFIG.logLimit) {
      this.state.log.splice(0, this.state.log.length - CONFIG.logLimit);
    }
  }

  private commit() {
    this.state.rngState = this.rng.getState();
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
  { id: 'atmosphere', label: 'Atmosphere', detail: 'Pulls a harsh tile into the livable zone' },
];
