import { CONFIG } from '../config';
import { crisisTuning } from './difficulty';
import { acceptsTrade, emptyTrade } from './diplomacy';
import { FACTIONS } from './factions';
import type { Game } from './game';
import { isHostileClimate, settleScore } from './geography';
import { buildableDesigns } from './parts';
import { nextQueuedResearch, pathToGoal } from './researchPath';
import { attackThreshold, canFoundCity, isSea, peaceWindow, projectAllowed } from './rules';
import { TECHS, techAvailable, techById } from './tech';
import { FACTION_IDS, type FactionId, type ImprovementId, type Personality, type TradeBundle, type Unit } from './types';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function nearestCity(tile: { x: number; y: number }, cities: readonly { x: number; y: number }[]): number {
  return cities.reduce((best, city) => Math.min(best, dist(tile, city)), 99);
}

function moveToward(game: Game, unit: Unit, score: (x: number, y: number) => number): boolean {
  const reach = game.reachable(unit.id);
  let best: { x: number; y: number; s: number } | null = null;
  for (const [key, step] of reach) {
    if (step.cost <= 0) continue;
    const [x, y] = key.split(',').map(Number);
    const s = score(x, y);
    if (!best || s > best.s) best = { x, y, s };
  }
  if (!best || best.s <= 0) return false;
  return game.moveUnit(unit.id, best.x, best.y).ok;
}

/** Walk as far as this turn's movement allows along a multi-turn path. */
function moveAlong(game: Game, unit: Unit, path: readonly { x: number; y: number }[]): boolean {
  const reach = game.reachable(unit.id);
  let best: { x: number; y: number } | null = null;
  for (const step of path) {
    const got = reach.get(`${step.x},${step.y}`);
    if (!got || got.cost <= 0 || got.cost > unit.movesLeft) break;
    best = step;
  }
  if (!best) return false;
  return game.moveUnit(unit.id, best.x, best.y).ok;
}

function pickProject(game: Game, unit: Unit): ImprovementId | null {
  const tile = game.tile(unit.x, unit.y);
  if (!tile || isSea(tile.terrain)) return null;
  const techs = game.state.factions[unit.factionId].techs;
  if (!tile.improvement) {
    if (isHostileClimate(tile.terrain) && projectAllowed('atmosphere', techs)) return 'atmosphere';
    if (tile.terrain === 'rocky' || tile.terrain === 'mountain' || tile.terrain === 'canyon' || tile.terrain === 'ridge') {
      return 'mine';
    }
    if (tile.terrain === 'thin-air' || tile.terrain === 'scorched' || tile.terrain === 'dunes' || tile.terrain === 'lava') {
      return 'solar';
    }
    if (tile.terrain === 'frozen-plain' || tile.terrain === 'toxic' || tile.terrain === 'ice-ridge') {
      return projectAllowed('atmosphere', techs) ? 'atmosphere' : 'solar';
    }
    return 'farm';
  }
  if (!tile.road) return 'road';
  return null;
}

function tryTerraform(game: Game, unit: Unit): boolean {
  const project = pickProject(game, unit);
  if (!project) return false;
  return game.startTerraform(unit.id, project).ok;
}

function oddsThreshold(personality: Personality, difficulty: string): number {
  const base = attackThreshold(personality.risk);
  const diff = CONFIG.ai.oddsAdjust[difficulty] ?? 0;
  const agg = CONFIG.ai.aggressionOdds[personality.aggression] ?? 0;
  return Math.max(0.28, Math.min(0.82, base + diff + agg));
}

/** Difficulty decides who is willing to fight once the peace window ends. */
export function wantsToFight(personality: Personality, difficulty: string, round: number): boolean {
  const windowTurns = peaceWindow(personality.aggression, difficulty);
  if (round <= windowTurns) return false;
  if (difficulty === 'brutal' || difficulty === 'hard') return true;
  if (difficulty === 'easy') {
    if (personality.aggression === 'very-aggressive') return true;
    if (personality.aggression === 'normal') return round > windowTurns + 10;
    return round > windowTurns + 18;
  }
  if (personality.aggression === 'easy') return round > windowTurns + 14;
  return true;
}

function supportOdds(game: Game, unit: Unit, x: number, y: number, odds: number): number {
  const friends = game.unitsOf(unit.factionId).filter(
    (other) => other.id !== unit.id && other.attack > 0 && other.aboard == null && dist(other, { x, y }) <= 3,
  ).length;
  const foes = game.state.units.filter(
    (other) => other.factionId !== unit.factionId && other.attack > 0 && other.aboard == null && dist(other, { x, y }) <= 1,
  ).length;
  const edge = friends + 1 - foes;
  if (edge <= 0) return odds;
  return Math.min(0.92, odds + Math.min(0.16, edge * 0.04));
}

function tryAttack(game: Game, unit: Unit, threshold: number, bold: boolean): boolean {
  let best: { x: number; y: number; rank: number } | null = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const preview = game.previewAttack(unit.id, unit.x + dx, unit.y + dy);
      if (!preview.ok) continue;
      const odds = supportOdds(game, unit, unit.x + dx, unit.y + dy, preview.odds);
      const need = preview.city ? Math.min(threshold, 0.45) : threshold;
      if (odds < need) continue;
      const rank = (bold ? (preview.city ? 3 : 1) : preview.city ? 2 : 0) + odds;
      if (!best || rank > best.rank) best = { x: unit.x + dx, y: unit.y + dy, rank };
    }
  }
  if (!best) return false;
  const occupant = game.state.units.find((other) => other.x === best.x && other.y === best.y && other.factionId !== unit.factionId);
  const city = game.cityAt(best.x, best.y);
  const foe = occupant?.factionId ?? (city && city.factionId !== unit.factionId ? city.factionId : null);
  const aggression = game.state.setup.personalities[unit.factionId].aggression;
  if (foe) {
    const stance = game.relation(unit.factionId, foe).stance;
    if (aggression !== 'easy' && (stance === 'nap' || stance === 'alliance')) game.propose(foe, 'war');
  }
  return game.confirmAttack(unit.id, best.x, best.y).ok;
}

function suggestTech(factionId: FactionId, techs: string[], focus: string): string | null {
  const available = TECHS.filter((tech) => tech.cost > 0 && techAvailable(tech, techs));
  if (!available.length) return null;
  const branch = FACTIONS[factionId].name;
  const pool = focus === 'specialty' ? available.filter((tech) => tech.branch === branch) : available;
  const list = (pool.length ? pool : available).slice().sort((a, b) => a.cost - b.cost);
  if (focus === 'general') return list[0].id;
  if (focus === 'balanced') return list[Math.min(list.length - 1, 1)].id;
  return list[0].id;
}

/** Technologies this faction should walk, earliest useful step first except a specialty capstone. */
function researchAgenda(factionId: FactionId, personality: Personality): string[] {
  const specialty = TECHS.filter((tech) => tech.cost > 0 && tech.branch === FACTIONS[factionId].name)
    .sort((a, b) => b.column - a.column || b.cost - a.cost)
    .map((tech) => tech.id);
  const practical = [
    'salvage-rigs',
    'advanced-formers',
    'jury-rig-power',
    'edible-flora',
    'master-formers',
    'atmosphere',
    'sealed-habitats',
    'field-clinics',
  ];
  if (personality.expansion !== 'expansionist') practical.splice(6, 0, 'soil-knit');
  if (personality.aggression !== 'easy') practical.push('coil-weapons');
  if (personality.research === 'specialty') return [...specialty, ...practical];
  if (personality.research === 'balanced') {
    const mixed: string[] = [];
    const span = Math.max(practical.length, specialty.length);
    for (let i = 0; i < span; i++) {
      if (practical[i]) mixed.push(practical[i]);
      if (specialty[i]) mixed.push(specialty[i]);
    }
    return mixed;
  }
  return [...practical, ...specialty];
}

/**
 * Next study for an AI faction on the tech graph.
 * A goal means the technology still has prerequisites, so the caller queues the path.
 */
export function chooseResearchTarget(
  factionId: FactionId,
  techs: readonly string[],
  personality: Personality,
): { id: string; asGoal: boolean } | null {
  const known = new Set(techs);
  for (const id of researchAgenda(factionId, personality)) {
    if (known.has(id)) continue;
    const tech = techById(id);
    if (!tech || tech.cost <= 0) continue;
    if (techAvailable(tech, techs)) return { id, asGoal: false };
    const path = pathToGoal(id, techs);
    if (path && path.length) return { id, asGoal: true };
  }
  const fallback = suggestTech(factionId, [...techs], personality.research);
  return fallback ? { id: fallback, asGoal: false } : null;
}

/** Legal founding sites left on the map. Stops counting once a handful are known. */
export function countFoundingSites(game: Game, factionId: FactionId): number {
  const hasSealed = game.state.factions[factionId].techs.includes('sealed-habitats');
  let found = 0;
  for (const tile of game.state.tiles) {
    if (isSea(tile.terrain)) continue;
    const check = canFoundCity({
      canFound: true,
      sea: false,
      hostile: isHostileClimate(tile.terrain),
      sealed: hasSealed,
      nearestCity: game.nearestCityDistance(tile.x, tile.y),
      cityHere: !!game.cityAt(tile.x, tile.y),
    });
    if (!check.ok) continue;
    found += 1;
    if (found >= 8) return found;
  }
  return found;
}

function nearSea(game: Game, x: number, y: number): boolean {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (!game.inBounds(x + dx, y + dy)) continue;
      if (isSea(game.tile(x + dx, y + dy).terrain)) return true;
    }
  }
  return false;
}

function atWarWith(game: Game, factionId: FactionId): boolean {
  return FACTION_IDS.some(
    (id) => id !== factionId && game.citiesOf(id).length > 0 && game.relation(factionId, id).stance === 'war',
  );
}

function mustFinishWar(game: Game, factionId: FactionId): boolean {
  if (game.state.setup.alliedVictory || game.state.round < 110) return false;
  const rivals = FACTION_IDS.filter((id) => id !== factionId && game.citiesOf(id).length > 0);
  return rivals.length === 1;
}

function cityGoal(game: Game, factionId: FactionId): number {
  const personality = game.state.setup.personalities[factionId];
  return Math.max(
    2,
    (CONFIG.ai.cityTarget[personality.expansion] ?? 3) + (CONFIG.ai.cityTargetAdjust[game.state.setup.difficulty] ?? 0),
  );
}

/** Field a rifle replacement once coil, plasma, or doctrine weapons are known. */
function ensureFieldDesign(game: Game, factionId: FactionId): void {
  const faction = game.state.factions[factionId];
  const weapon = faction.techs.includes('planetary-supremacy')
    ? 'doctrine'
    : faction.techs.includes('plasma-lance')
      ? 'plasma'
      : faction.techs.includes('coil-weapons')
        ? 'coil'
        : null;
  if (!weapon) return;
  if (faction.customDesigns.some((design) => design.chassis === 'infantry' && design.weapon === weapon)) return;
  const names: Record<string, string> = {
    coil: 'Coil Infantry',
    plasma: 'Plasma Infantry',
    doctrine: 'Doctrine Infantry',
  };
  game.createDesign({ name: names[weapon] ?? 'Field Infantry', chassis: 'infantry', weapon, armor: 'scrap', specials: [] });
}

/** What an AI city should build next. Called again after every completion. */
export function chooseDesign(game: Game, factionId: FactionId): string | null {
  const faction = game.state.factions[factionId];
  const personality = game.state.setup.personalities[factionId];
  const difficulty = game.state.setup.difficulty;
  ensureFieldDesign(game, factionId);
  const designs = buildableDesigns(faction.techs, faction.customDesigns);
  const byRole = (role: string) => {
    const list = designs.filter((design) => design.role === role);
    const pool = role === 'military' ? list.filter((design) => design.cost <= 28) : list;
    const ranked = (pool.length ? pool : list).slice().sort((a, b) => b.attack - a.attack || a.cost - b.cost);
    return ranked[0];
  };
  const transport = designs.find((design) => design.transport > 0);
  const gunboat = designs.find((design) => design.domain === 'sea' && design.attack > 0);
  const cities = game.citiesOf(factionId);
  const units = game.unitsOf(factionId);
  const pods = units.filter((unit) => unit.canFound).length;
  const formers = units.filter((unit) => unit.canTerraform).length;
  const military = units.filter((unit) => unit.role === 'military').length;
  const armedShips = units.filter((unit) => unit.domain === 'sea' && unit.attack > 0).length;
  const transports = units.filter((unit) => unit.transport > 0).length;
  const sites = countFoundingSites(game, factionId);
  const podCap = Math.min(CONFIG.ai.podCap[personality.expansion] ?? 1, sites);
  const cityTarget = cityGoal(game, factionId);
  const aggressionBonus = personality.aggression === 'very-aggressive' ? 2 : personality.aggression === 'easy' ? 0 : 1;
  const militaryTarget = cities.length + (CONFIG.ai.militaryExtra[difficulty] ?? 0) + aggressionBonus;
  const formerTarget =
    personality.expansion === 'builder' ? Math.max(1, cities.length) : Math.max(1, Math.ceil(cities.length / 2));
  const coast = cities.some((city) => nearSea(game, city.x, city.y));
  const fighting =
    wantsToFight(personality, difficulty, game.state.round) || atWarWith(game, factionId) || mustFinishWar(game, factionId);
  const barge = designs.find((design) => design.domain === 'sea' && design.transport > 0 && design.attack <= 0);

  if (cities.length > 0 && military < cities.length) return (byRole('military') ?? byRole('scout'))?.id ?? null;
  const leaderCities = FACTION_IDS.reduce(
    (best, id) => (id === factionId ? best : Math.max(best, game.citiesOf(id).length)),
    0,
  );
  const behind = leaderCities > cities.length && personality.aggression !== 'easy' && fighting;
  if (behind && military < Math.min(leaderCities, cities.length + 2)) {
    return (byRole('military') ?? byRole('scout'))?.id ?? null;
  }
  if (pods < podCap && cities.length < cityTarget) return byRole('settler')?.id ?? null;
  const bargesBuilding = barge ? cities.filter((city) => city.production?.designId === barge.id).length : 0;
  if (cutOff(game, factionId) && transports + bargesBuilding < 2 && barge) return barge.id;
  if (fighting && military < militaryTarget) return (byRole('military') ?? byRole('scout'))?.id ?? null;
  if (formers < 1 || (formers < formerTarget && personality.expansion !== 'expansionist')) {
    return byRole('terraformer')?.id ?? null;
  }
  if (military < militaryTarget) return (byRole('military') ?? byRole('scout'))?.id ?? null;
  if (coast && transports < 1 && transport) return transport.id;
  if (coast && fighting && armedShips < 1 && gunboat) return gunboat.id;
  if (personality.expansion === 'builder' && formers < formerTarget) return byRole('terraformer')?.id ?? null;
  const powersLeft = FACTION_IDS.filter((id) => game.citiesOf(id).length > 0).length;
  if (powersLeft <= 2 && fighting && cities.length > 0) return (byRole('military') ?? byRole('scout'))?.id ?? null;
  return null;
}

function bestFoundingPath(game: Game, unit: Unit, factionId: FactionId): { x: number; y: number }[] | null {
  const faction = game.state.factions[factionId];
  const hasSealed = faction.techs.includes('sealed-habitats');
  const own = game.citiesOf(factionId);
  const ranked: { x: number; y: number; score: number }[] = [];
  for (const tile of game.state.tiles) {
    if (isSea(tile.terrain)) continue;
    const check = canFoundCity({
      canFound: true,
      sea: false,
      hostile: isHostileClimate(tile.terrain),
      sealed: hasSealed,
      nearestCity: game.nearestCityDistance(tile.x, tile.y),
      cityHere: !!game.cityAt(tile.x, tile.y),
    });
    if (!check.ok) continue;
    const nearestOwn = own.reduce((best, city) => Math.min(best, dist(city, tile)), 99);
    let score = 8 + Math.min(nearestOwn, 8) + Math.max(0, settleScore(tile));
    if (tile.resource || tile.special) score += 3;
    if (tile.terrain === 'grass' || tile.terrain === 'forest' || tile.terrain === 'coast') score += 2;
    score -= dist(unit, tile) * 0.45;
    ranked.push({ x: tile.x, y: tile.y, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const site of ranked.slice(0, 6)) {
    const path = game.route(unit.id, site.x, site.y);
    if (path) return path;
  }
  return null;
}

interface Strike {
  x: number;
  y: number;
  score: number;
}

/** War opponent with the fewest cities. A leader focuses here so a long war can end. */
function weakestWarOpponent(game: Game, factionId: FactionId): FactionId | null {
  let weakest: FactionId | null = null;
  let cities = 99;
  for (const id of FACTION_IDS) {
    if (id === factionId) continue;
    if (game.relation(factionId, id).stance !== 'war') continue;
    const count = game.citiesOf(id).length;
    if (count <= 0 || count >= cities) continue;
    weakest = id;
    cities = count;
  }
  return weakest;
}

function strikeTarget(game: Game, factionId: FactionId, unit: Unit): Strike | null {
  let best: Strike | null = null;
  const consider = (x: number, y: number, score: number) => {
    if (!best || score > best.score) best = { x, y, score };
  };
  const mine = game.citiesOf(factionId).length;
  const bestOther = FACTION_IDS.reduce(
    (best, id) => (id === factionId ? best : Math.max(best, game.citiesOf(id).length)),
    0,
  );
  const leading = game.state.round > 100 && mine >= 3 && mine > bestOther;
  const weakest = leading ? weakestWarOpponent(game, factionId) : null;
  for (const city of game.state.cities) {
    if (city.factionId === factionId) continue;
    const rel = game.relation(factionId, city.factionId);
    if (rel.stance === 'nap' || rel.stance === 'alliance') continue;
    const away = dist(unit, city);
    if (!game.isExplored(factionId, city.x, city.y) && away > 14) continue;
    const garrison = game.state.units.filter(
      (other) => other.x === city.x && other.y === city.y && other.factionId === city.factionId && other.attack > 0,
    ).length;
    const crisisDamage = crisisTuning(game.state.round, game.state.setup.difficulty).damage;
    let score = 48 - away * (crisisDamage >= 4 ? 2 : 1);
    if (garrison === 0) score += 14;
    if (city.defenseHp < CONFIG.city.militiaHp) score += 8;
    if (rel.stance === 'war') score += 12;
    if (game.citiesOf(city.factionId).length <= 1) score += 8;
    if (weakest && city.factionId === weakest) score += 28;
    if (mine < bestOther && game.citiesOf(city.factionId).length === bestOther) score += 22;
    consider(city.x, city.y, score);
  }
  for (const other of game.state.units) {
    if (other.factionId === factionId || other.aboard != null) continue;
    if (!other.canFound && other.attack <= 0) continue;
    const rel = game.relation(factionId, other.factionId);
    if (rel.stance === 'nap' || rel.stance === 'alliance') continue;
    const away = dist(unit, other);
    if (!game.isExplored(factionId, other.x, other.y) && away > 10) continue;
    let score = (other.canFound ? 52 : 24) - away;
    if (other.canFound && game.citiesOf(other.factionId).length === 0) score += 24;
    if (rel.stance === 'war') score += 8;
    if (weakest && other.factionId === weakest) score += 16;
    consider(other.x, other.y, score);
  }
  return best;
}

function cutOff(game: Game, factionId: FactionId): boolean {
  const probe = game.unitsOf(factionId).find((unit) => unit.domain === 'land' && unit.aboard == null);
  if (!probe) return false;
  for (const city of game.state.cities) {
    if (city.factionId === factionId) continue;
    const rel = game.relation(factionId, city.factionId);
    if (rel.stance === 'nap' || rel.stance === 'alliance') continue;
    if (!game.route(probe.id, city.x, city.y)) return true;
  }
  return false;
}

function seekShip(game: Game, unit: Unit): boolean {
  const ships = game.unitsOf(unit.factionId).filter((ship) => ship.domain === 'sea' && ship.transport > ship.cargo.length);
  if (!ships.length) return false;
  const ship = ships.slice().sort((a, b) => dist(unit, a) - dist(unit, b))[0];
  let best: { x: number; y: number }[] | null = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ship.x + dx;
      const y = ship.y + dy;
      if (!game.inBounds(x, y) || isSea(game.tile(x, y).terrain)) continue;
      const path = game.route(unit.id, x, y);
      if (!path) continue;
      if (!best || path.length < best.length) best = path;
    }
  }
  if (!best) return false;
  if (best.length) moveAlong(game, unit, best);
  return true;
}

function coastalSeaNear(game: Game, goal: { x: number; y: number }): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 0; y < game.state.height; y++) {
    for (let x = 0; x < game.state.width; x++) {
      if (!isSea(game.tile(x, y).terrain)) continue;
      let land = false;
      for (let dy = -1; dy <= 1 && !land; dy++) {
        for (let dx = -1; dx <= 1 && !land; dx++) {
          if (!dx && !dy) continue;
          if (!game.inBounds(x + dx, y + dy)) continue;
          if (!isSea(game.tile(x + dx, y + dy).terrain)) land = true;
        }
      }
      if (!land) continue;
      const d = dist({ x, y }, goal);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function approach(game: Game, unit: Unit, target: { x: number; y: number }): boolean {
  if (dist(unit, target) <= 1) return false;
  if (unit.domain === 'sea') {
    let best: { x: number; y: number }[] | null = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (!game.inBounds(x, y) || !isSea(game.tile(x, y).terrain)) continue;
        const path = game.route(unit.id, x, y);
        if (!path) continue;
        if (!best || path.length < best.length) best = path;
      }
    }
    if (!best || !best.length) return false;
    return moveAlong(game, unit, best);
  }
  const path = game.route(unit.id, target.x, target.y);
  if (!path || !path.length) return false;
  return moveAlong(game, unit, path);
}

function garrisonIds(game: Game, factionId: FactionId): Set<number> {
  const held = new Set<number>();
  const soldiers = game.unitsOf(factionId).filter((unit) => unit.role === 'military' && unit.attack > 0 && unit.aboard == null);
  const cities = game.citiesOf(factionId);
  const powers = FACTION_IDS.filter((id) => game.citiesOf(id).length > 0).length;
  const span = powers === 2 ? 2 : 6;
  for (const city of cities) {
    const threatened = game.state.cities.some(
      (other) => other.factionId !== factionId && dist(other, city) <= span && game.relation(factionId, other.factionId).stance !== 'alliance',
    );
    if (!threatened && cities.length > 1) continue;
    const guard = soldiers.find((unit) => !held.has(unit.id) && dist(unit, city) <= 1);
    if (guard) held.add(guard.id);
  }
  return held;
}

function rotatePick<T extends { id: FactionId; score: number }>(rows: T[], round: number): FactionId | null {
  if (!rows.length) return null;
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const top = rows.filter((row) => row.score === rows[0].score);
  return top[round % top.length].id;
}

function aiTransport(game: Game, unit: Unit, factionId: FactionId): void {
  const goal = strikeTarget(game, factionId, unit);
  if (unit.cargo.length && unit.movesLeft > 0) {
    const drops = game.coastalDrops(unit.id);
    const enemies = game.state.cities.filter((city) => city.factionId !== factionId);
    if (drops.length && enemies.length) {
      const ranked = drops.slice().sort((a, b) => nearestCity(a, enemies) - nearestCity(b, enemies));
      const drop = ranked[0];
      if (nearestCity(drop, enemies) <= 10) {
        const rider = unit.cargo[0];
        if (game.unloadUnit(unit.id, rider, drop.x, drop.y).ok) return;
      }
    }
  }
  if (unit.cargo.length < unit.transport && unit.movesLeft > 0) {
    const passenger = game.boardableUnits(unit.id).find((other) => other.canFound || other.role === 'military');
    if (passenger && game.loadUnit(unit.id, passenger.id).ok) return;
  }
  if (unit.movesLeft <= 0) return;
  if (goal) {
    const harbor = coastalSeaNear(game, goal);
    if (harbor && !approach(game, unit, goal)) approach(game, unit, harbor);
  }
  else {
    moveToward(game, unit, (x, y) => {
      const seen = game.isExplored(factionId, x, y);
      return (seen ? 1 : 8) + (isSea(game.tile(x, y).terrain) ? 1 : 0);
    });
  }
}

function considerTrade(game: Game, factionId: FactionId, personality: Personality) {
  if (personality.diplomacy === 'alone' && game.roll() > 0.2) return;
  if (personality.diplomacy !== 'trader' && game.roll() > 0.4) return;
  const partners = FACTION_IDS.filter((id) => id !== factionId && game.inContact(factionId, id) && game.relation(factionId, id).stance !== 'war');
  if (!partners.length) return;
  const partner = partners[game.state.round % partners.length];
  const me = game.state.factions[factionId];
  const them = game.state.factions[partner];
  const give = emptyTrade();
  const want = emptyTrade();
  if (me.minerals >= 16 && them.energy >= 8) {
    give.minerals = 8;
    want.energy = 6;
  } else if (me.energy >= 16 && them.minerals >= 8) {
    give.energy = 8;
    want.minerals = 6;
  } else if (me.nutrients >= 14 && them.minerals >= 8) {
    give.nutrients = 8;
    want.minerals = 6;
  } else if (me.credits >= 45 && (them.minerals >= 8 || them.nutrients >= 8)) {
    give.credits = 12;
    if (them.minerals >= 8) want.minerals = 8;
    else want.nutrients = 6;
  } else {
    const offerTech = me.techs.find((tech) => tech !== 'field-formers' && !them.techs.includes(tech));
    const wantTech = them.techs.find((tech) => tech !== 'field-formers' && !me.techs.includes(tech));
    if (offerTech && wantTech) {
      give.tech = offerTech;
      want.tech = wantTech;
    } else if (offerTech) {
      give.tech = offerTech;
      want.credits = 18;
    } else return;
  }
  const offered = tradeValueOf(want, me, give.tech);
  const asked = tradeValueOf(give, them, want.tech);
  if (!acceptsTrade({ diplomacy: personality.diplomacy, memory: 0, stance: 'peace', offered: asked, asked: offered }) && personality.diplomacy !== 'trader') {
    return;
  }
  game.proposeTrade(partner, give, want);
}

function tradeValueOf(bundle: TradeBundle, receiver: { techs: string[] }, tech: string | null): number {
  void tech;
  const known = bundle.tech ? receiver.techs.includes(bundle.tech) : false;
  return (bundle.credits ?? 0) + (bundle.minerals ?? 0) + (bundle.nutrients ?? 0) + (bundle.energy ?? 0) + (bundle.tech && !known ? CONFIG.diplomacy.trade.techValue : 0);
}

function considerSpies(game: Game, factionId: FactionId, personality: Personality) {
  const faction = game.state.factions[factionId];
  const others = FACTION_IDS.filter((id) => id !== factionId);
  const owned = game.state.spies.filter((spy) => spy.owner === factionId);
  const cap = factionId === 'mnemosyne' ? 2 : 1;
  const likesSpies = personality.diplomacy === 'alone' || factionId === 'mnemosyne' || personality.risk === 'bold';
  if (faction.credits > CONFIG.spies.recruitCost + 25 && owned.length < cap && (likesSpies || game.roll() < 0.3)) {
    game.recruitSpy();
  }
  const idle = game.state.spies.find((spy) => spy.owner === factionId && !spy.host);
  if (idle) {
    const host = rotatePick(
      others.map((id) => {
        const unknown = game.state.factions[id].techs.filter((tech) => !faction.techs.includes(tech)).length;
        const war = game.relation(factionId, id).stance === 'war' ? 3 : 0;
        const taken = game.state.spies.some((spy) => spy.owner === factionId && spy.host === id) ? -20 : 0;
        return { id, score: unknown + war + taken };
      }),
      game.state.round,
    );
    if (host) game.placeSpy(idle.id, host);
  }
  for (const spy of game.state.spies.filter((entry) => entry.owner === factionId && entry.host)) {
    if (!game.state.spies.some((entry) => entry.id === spy.id)) continue;
    const hostId = spy.host!;
    const unknown = game.state.factions[hostId].techs.filter((tech) => !faction.techs.includes(tech));
    const atWar = game.relation(factionId, hostId).stance === 'war';
    const bold = personality.risk === 'bold' || factionId === 'mnemosyne';
    if (unknown.length && game.roll() < (bold ? 0.7 : 0.4)) {
      const tech = unknown[Math.floor(game.roll() * unknown.length)] ?? unknown[0];
      game.stealTech(spy.id, tech);
      continue;
    }
    if ((atWar || personality.aggression === 'very-aggressive') && game.roll() < (bold ? 0.6 : 0.35)) {
      game.sabotage(spy.id);
    }
  }
  const infiltrated = game.state.spies.some((spy) => spy.host === factionId && spy.owner !== factionId);
  if (infiltrated && game.roll() < 0.85) game.sweepSpies();
  else if (game.state.round % 8 === 0 && personality.risk !== 'bold') game.sweepSpies();
}

function considerPolitics(game: Game, factionId: FactionId, personality: Personality) {
  const others = FACTION_IDS.filter((id) => id !== factionId);
  const met = others.filter((id) => game.inContact(factionId, id));
  const difficulty = game.state.setup.difficulty;
  const fighting = wantsToFight(personality, difficulty, game.state.round);
  if (fighting) {
    const mine = game.citiesOf(factionId).length;
    const bestOther = others.reduce((best, id) => Math.max(best, game.citiesOf(id).length), 0);
    if (mine >= 3 && mine > bestOther) {
      const holdouts = met
        .filter((id) => game.citiesOf(id).length > 0 && game.relation(factionId, id).stance !== 'war')
        .map((id) => ({ id, score: game.citiesOf(id).length }));
      const target = rotatePick(holdouts, game.state.round);
      if (target) {
        game.propose(target, 'war');
        return;
      }
    }
  }
  if (fighting && (personality.aggression === 'very-aggressive' || personality.diplomacy === 'alone' || difficulty === 'hard' || difficulty === 'brutal')) {
    const target = rotatePick(
      met.map((id) => {
        const rel = game.relation(factionId, id);
        const cities = game.citiesOf(id).length;
        const already = rel.stance === 'war' ? -8 : rel.stance === 'alliance' ? 8 : 6;
        return { id, score: 24 - cities * 3 + already - rel.memory * 0.05 };
      }).filter((row) => row.score > -40),
      game.state.round,
    );
    if (target && game.relation(factionId, target).stance !== 'war') {
      game.propose(target, 'war');
      return;
    }
  }
  if (personality.diplomacy === 'treaty' && personality.aggression !== 'very-aggressive') {
    const war = met.find((id) => game.relation(factionId, id).stance === 'war');
    if (war && !fighting) game.propose(war, 'peace');
    else if (!war) {
      const peace = met.find((id) => game.relation(factionId, id).stance === 'peace');
      if (peace) game.propose(peace, 'nap');
      else if (personality.aggression === 'easy') {
        const nap = met.find((id) => game.relation(factionId, id).stance === 'nap');
        if (nap) game.propose(nap, 'alliance');
      }
    }
  } else if (personality.diplomacy === 'trader') {
    const partner = met.find((id) => {
      const rel = game.relation(factionId, id);
      return rel.stance !== 'war' && !rel.research;
    });
    if (partner) game.propose(partner, 'research');
  }
  if (mustFinishWar(game, factionId)) {
    const last = FACTION_IDS.find((id) => id !== factionId && game.citiesOf(id).length > 0);
    if (last && game.relation(factionId, last).stance !== 'war') game.propose(last, 'war');
  }
  considerTrade(game, factionId, personality);
  considerSpies(game, factionId, personality);
}

export function runAi(game: Game): void {
  const factionId = game.state.whoseTurn;
  const faction = game.state.factions[factionId];
  if (!faction || faction.isHuman) return;
  const personality = game.state.setup.personalities[factionId];
  const difficulty = game.state.setup.difficulty;
  const fighting =
    wantsToFight(personality, difficulty, game.state.round) || atWarWith(game, factionId) || mustFinishWar(game, factionId);
  let threshold = oddsThreshold(personality, difficulty);
  const mineNow = game.citiesOf(factionId).length;
  const bestOtherNow = FACTION_IDS.reduce(
    (best, id) => (id === factionId ? best : Math.max(best, game.citiesOf(id).length)),
    0,
  );
  if (fighting && mineNow + 1 < bestOtherNow && personality.aggression !== 'easy') {
    threshold = Math.max(0.28, threshold - 0.14);
  }
  if (game.state.round > 80) {
    const pressing =
      mineNow > bestOtherNow ||
      (mineNow === bestOtherNow && mineNow > 0 && (personality.aggression === 'very-aggressive' || personality.risk === 'bold'));
    if (pressing) {
      const cut = personality.risk === 'bold' || personality.aggression === 'very-aggressive' ? 0.12 : 0.04;
      threshold = Math.max(0.28, threshold - cut);
    }
    const powersLeft = FACTION_IDS.filter((id) => game.citiesOf(id).length > 0).length;
    if (fighting && powersLeft === 2 && game.state.round > 180) {
      threshold = Math.max(0.16, threshold - 0.4);
    }
  }

  if (!faction.researching) {
    const queued = nextQueuedResearch(faction.researchQueue, faction.techs);
    if (queued) game.chooseResearch(queued);
    else {
      const target = chooseResearchTarget(factionId, faction.techs, personality);
      if (target?.asGoal) game.setResearchGoal(target.id);
      else if (target) game.chooseResearch(target.id);
    }
  }

  const sites = countFoundingSites(game, factionId);
  for (const city of game.citiesOf(factionId)) {
    if (city.production) continue;
    const design = chooseDesign(game, factionId);
    if (design) game.setProduction(city.id, design);
  }

  const guards = garrisonIds(game, factionId);
  const units = [...game.unitsOf(factionId)].sort((a, b) => {
    if (a.domain !== b.domain) return a.domain === 'land' ? -1 : 1;
    return a.id - b.id;
  });
  for (const unit of units) {
    if (!game.state.units.some((other) => other.id === unit.id)) continue;
    if (unit.aboard != null || unit.terraform || unit.movesLeft <= 0) continue;
    if (unit.canFound) {
      const goal = cityGoal(game, factionId);
      if (game.citiesOf(factionId).length >= goal || (sites === 0 && game.citiesOf(factionId).length > 0)) {
        game.disband(unit.id);
        continue;
      }
      if (game.foundCity(unit.id).ok) continue;
      const path = bestFoundingPath(game, unit, factionId);
      if (path && path.length) moveAlong(game, unit, path);
      else {
        const sealed = faction.techs.includes('sealed-habitats');
        moveToward(game, unit, (x, y) => {
          const tile = game.tile(x, y);
          if (isSea(tile.terrain)) return 0;
          const hostile = isHostileClimate(tile.terrain);
          const check = canFoundCity({
            canFound: true,
            sea: false,
            hostile,
            sealed,
            nearestCity: game.nearestCityDistance(x, y),
            cityHere: !!game.cityAt(x, y),
          });
          if (check.ok) return 100 + Math.max(0, settleScore(tile));
          if (hostile && !sealed) return 1;
          return 4 + game.nearestCityDistance(x, y) * 12 + Math.max(0, settleScore(tile));
        });
      }
      game.foundCity(unit.id);
      continue;
    }
    if (unit.canTerraform) {
      if (tryTerraform(game, unit)) continue;
      moveToward(game, unit, (x, y) => {
        const tile = game.tile(x, y);
        if (isSea(tile.terrain) || tile.improvement) return tile.road ? 0 : 1;
        if (faction.credits < CONFIG.terraform.baseFee || faction.energy < (CONFIG.terraform.energyCost[pickProject(game, unit) ?? 'farm'] ?? 0)) {
          return 0;
        }
        let score = 2 + Math.max(0, settleScore(tile));
        if (tile.resource || tile.special) score += 2;
        if (isHostileClimate(tile.terrain) && projectAllowed('atmosphere', faction.techs)) score += 2;
        return score;
      });
      tryTerraform(game, unit);
      continue;
    }
    if (unit.domain === 'sea' && unit.transport > 0 && unit.attack <= 0) {
      aiTransport(game, unit, factionId);
      continue;
    }
    const sealedNow = faction.techs.includes('sealed-habitats');
    const pulse = crisisTuning(game.state.round, game.state.setup.difficulty).damage;
    const shelter = pulse >= 3 && !sealedNow;
    if (!fighting && unit.role === 'military' && unit.attack > 0) {
      const home = game.citiesOf(factionId).slice().sort((a, b) => dist(unit, a) - dist(unit, b))[0];
      if (home && dist(unit, home) > 1) approach(game, unit, home);
      continue;
    }
    if (fighting && unit.attack > 0) {
      if (guards.has(unit.id)) {
        tryAttack(game, unit, threshold, personality.risk === 'bold');
        continue;
      }
      if (tryAttack(game, unit, threshold, personality.risk === 'bold')) continue;
      const crisisDamage = crisisTuning(game.state.round, game.state.setup.difficulty).damage;
      const sealed = faction.techs.includes('sealed-habitats');
      const powersLeft = FACTION_IDS.filter((id) => game.citiesOf(id).length > 0).length;
      const finishing = powersLeft === 2 && game.state.round > 160;
      if (!finishing && !sealed && crisisDamage > 0 && unit.hp <= crisisDamage && !guards.has(unit.id)) {
        const home = game.citiesOf(factionId).slice().sort((a, b) => dist(unit, a) - dist(unit, b))[0];
        if (home && dist(unit, home) > 0) {
          approach(game, unit, home);
          continue;
        }
      }
      const closeCity = game.state.cities
        .filter((city) => {
          if (city.factionId === factionId) return false;
          const rel = game.relation(factionId, city.factionId);
          return rel.stance !== 'nap' && rel.stance !== 'alliance' && dist(unit, city) <= 5;
        })
        .sort((a, b) => dist(unit, a) - dist(unit, b))[0];
      if (closeCity) {
        approach(game, unit, closeCity);
        if (game.state.units.some((other) => other.id === unit.id)) {
          tryAttack(game, unit, Math.max(0.22, threshold - 0.12), personality.risk === 'bold');
        }
        continue;
      }
      const target = shelter && !atWarWith(game, factionId) ? null : strikeTarget(game, factionId, unit);
      if (target) {
        const ashore = unit.domain === 'land' && game.route(unit.id, target.x, target.y);
        if (unit.domain === 'land' && !ashore) {
          seekShip(game, unit);
          continue;
        }
        approach(game, unit, target);
        if (game.state.units.some((other) => other.id === unit.id)) {
          tryAttack(game, unit, threshold, personality.risk === 'bold');
        }
        continue;
      }
    }
    if (!unit.searching && unit.role === 'scout') unit.searching = true;
    const here = game.tile(unit.x, unit.y);
    if (shelter && (here.improvement || here.scarred || game.cityAt(unit.x, unit.y))) continue;
    const home = game.citiesOf(factionId)[0];
    const angle = ((unit.id * 47) % 8) * (Math.PI / 4);
    const goal = shelter || unit.attack > 0 ? null : exploreGoal(game, factionId, unit, angle, home);
    moveToward(game, unit, (x, y) => {
      const seen = game.isExplored(factionId, x, y);
      const tile = game.tile(x, y);
      let score = seen ? 1 : 14;
      if (!isSea(tile.terrain)) score += 1;
      if (tile.river) score += 1;
      if ((tile.resource || tile.special) && !seen) score += 2;
      if (isHostileClimate(tile.terrain)) score -= 2;
      if (tile.road) score += 2;
      if (tile.improvement || tile.scarred || game.cityAt(x, y)) score += shelter ? 48 : 3;
      if (goal) score += 36 - dist({ x, y }, goal);
      return score;
    });
  }
  considerPolitics(game, factionId, personality);
}

function exploreGoal(
  game: Game,
  factionId: FactionId,
  unit: Unit,
  angle: number,
  home: { x: number; y: number } | undefined,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (const tile of game.state.tiles) {
    if (isSea(tile.terrain) || game.isExplored(factionId, tile.x, tile.y)) continue;
    let score = -dist(unit, tile);
    if (home) {
      score += ((tile.x - home.x) * Math.cos(angle) + (tile.y - home.y) * Math.sin(angle)) * 0.35;
    }
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}
