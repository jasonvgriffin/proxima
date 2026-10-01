import { CONFIG } from '../config';
import { FACTIONS } from './factions';
import type { Game } from './game';
import { isSea, attackThreshold, canFoundCity, peaceWindow, projectAllowed, tileIsLivable } from './rules';
import { TECHS, techAvailable } from './tech';
import { buildableDesigns } from './parts';
import type { FactionId, ImprovementId, Personality, Unit } from './types';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
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

function pickProject(game: Game, unit: Unit): ImprovementId | null {
  const tile = game.tile(unit.x, unit.y);
  if (!tile || isSea(tile.terrain)) return null;
  const techs = game.state.factions[unit.factionId].techs;
  if (!tile.improvement) {
    if (!tileIsLivable(tile) && projectAllowed('atmosphere', techs)) return 'atmosphere';
    if (tile.terrain === 'rocky' || tile.terrain === 'mountain' || tile.terrain === 'canyon' || tile.terrain === 'ridge') {
      return 'mine';
    }
    if (tile.zone === 'day' || tile.terrain === 'thin-air' || tile.terrain === 'scorched' || tile.terrain === 'dunes') {
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

function tryAttack(game: Game, unit: Unit, risk: string): boolean {
  const threshold = attackThreshold(risk);
  let best: { x: number; y: number; rank: number } | null = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const preview = game.previewAttack(unit.id, unit.x + dx, unit.y + dy);
      if (!preview.ok || preview.odds < threshold) continue;
      const rank = risk === 'bold' ? (preview.city ? 3 : 1) + preview.odds : preview.odds;
      if (!best || rank > best.rank) best = { x: unit.x + dx, y: unit.y + dy, rank };
    }
  }
  if (!best) return false;
  return game.confirmAttack(unit.id, best.x, best.y).ok;
}

function suggestTech(factionId: FactionId, techs: string[], focus: string): string | null {
  const available = TECHS.filter((tech) => tech.cost > 0 && techAvailable(tech, techs));
  if (!available.length) return null;
  const branch = FACTIONS[factionId].name;
  const pool =
    focus === 'specialty' ? available.filter((tech) => tech.branch === branch) : available;
  const list = (pool.length ? pool : available).slice().sort((a, b) => a.cost - b.cost);
  if (focus === 'general') return list[0].id;
  if (focus === 'balanced') {
    const mid = list[Math.min(list.length - 1, 1)];
    return mid.id;
  }
  return list[0].id;
}

export function runAi(game: Game): void {
  const factionId = game.state.whoseTurn;
  const faction = game.state.factions[factionId];
  if (!faction || faction.isHuman) return;
  const personality = game.state.setup.personalities[factionId];
  const windowTurns = peaceWindow(personality.aggression, game.state.setup.difficulty);
  const hostile = game.state.round > windowTurns && personality.aggression !== 'easy';

  if (!faction.researching) {
    const next = suggestTech(factionId, faction.techs, personality.research);
    if (next) game.chooseResearch(next);
  }

  const designs = buildableDesigns(faction.techs, faction.customDesigns);
  const byRole = (role: string) => designs.find((design) => design.role === role);
  for (const city of game.citiesOf(factionId)) {
    if (city.production) continue;
    const cities = game.citiesOf(factionId).length;
    const formers = game.unitsOf(factionId).filter((unit) => unit.canTerraform).length;
    const settlers = game.unitsOf(factionId).filter((unit) => unit.canFound).length;
    let design = byRole('military') ?? byRole('scout');
    if (personality.expansion === 'builder') {
      if (formers < cities) design = byRole('terraformer') ?? design;
      else if (cities < 2 && settlers < 1) design = byRole('settler') ?? design;
    } else if (personality.expansion === 'expansionist') {
      if (cities < 4 && settlers < 1) design = byRole('settler') ?? design;
    } else if (cities < 2 && settlers < 1) design = byRole('settler') ?? design;
    else if (formers < 1) design = byRole('terraformer') ?? design;
    if (design) game.setProduction(city.id, design.id);
  }

  for (const unit of [...game.unitsOf(factionId)]) {
    if (!game.state.units.some((other) => other.id === unit.id)) continue;
    if (unit.terraform || unit.movesLeft <= 0) continue;
    if (unit.canFound) {
      if (game.foundCity(unit.id).ok) continue;
      moveToward(game, unit, (x, y) => {
        const tile = game.tile(x, y);
        const check = canFoundCity({
          canFound: true,
          sea: isSea(tile.terrain),
          livable: tile.livable,
          inBand: tile.zone === 'twilight',
          hasSealed: faction.techs.includes('sealed-habitats'),
          nearestCity: game.nearestCityDistance(x, y),
          cityHere: !!game.cityAt(x, y),
        });
        if (!check.ok) return 0;
        const spread = Math.min(
          12,
          game.citiesOf(factionId).reduce((best, city) => Math.min(best, dist(city, { x, y })), 12),
        );
        return 8 + spread;
      });
      game.foundCity(unit.id);
      continue;
    }
    if (unit.canTerraform) {
      if (tryTerraform(game, unit)) continue;
      moveToward(game, unit, (x, y) => {
        const tile = game.tile(x, y);
        if (isSea(tile.terrain) || tile.improvement) return tile.road ? 0 : 1;
        const fee = CONFIG.terraform.baseFee;
        if (faction.credits < fee) return 0;
        let score = tile.zone === 'twilight' ? 6 : 3;
        if (tile.resource) score += 2;
        if (!tileIsLivable(tile)) score += 2;
        return score;
      });
      tryTerraform(game, unit);
      continue;
    }
    if (hostile && unit.attack > 0) {
      if (tryAttack(game, unit, personality.risk)) continue;
      const chased = moveToward(game, unit, (x, y) => {
        let best = 0;
        for (const city of game.state.cities) {
          if (city.factionId === factionId) continue;
          if (!game.isExplored(factionId, city.x, city.y)) continue;
          best = Math.max(best, 48 - dist({ x, y }, city));
        }
        for (const other of game.state.units) {
          if (other.factionId === factionId) continue;
          if (!game.isExplored(factionId, other.x, other.y)) continue;
          best = Math.max(best, 36 - dist({ x, y }, other));
        }
        return best;
      });
      if (chased && tryAttack(game, unit, personality.risk)) continue;
    }
    if (!unit.searching && (unit.role === 'scout' || unit.role === 'naval' || unit.role === 'military')) {
      unit.searching = unit.role === 'scout';
    }
    moveToward(game, unit, (x, y) => {
      const seen = game.isExplored(factionId, x, y);
      const tile = game.tile(x, y);
      let score = seen ? 1 : 9;
      if (tile.zone === 'twilight') score += 2;
      if (tile.resource && !seen) score += 2;
      return score;
    });
  }
  considerPolitics(game, factionId, personality);
}

function considerPolitics(game: Game, factionId: FactionId, personality: Personality) {
  const others = (Object.keys(game.state.factions) as FactionId[]).filter((id) => id !== factionId);
  const windowTurns = peaceWindow(personality.aggression, game.state.setup.difficulty);
  if (personality.diplomacy === 'alone' && personality.aggression === 'very-aggressive' && game.state.round > windowTurns) {
    const target = others.slice().sort((a, b) => game.relation(factionId, b).memory - game.relation(factionId, a).memory)[0];
    if (target && game.relation(factionId, target).stance !== 'war') game.propose(target, 'war');
    return;
  }
  if (personality.diplomacy === 'treaty') {
    const war = others.find((id) => game.relation(factionId, id).stance === 'war');
    if (war) game.propose(war, 'peace');
    else {
      const peace = others.find((id) => game.relation(factionId, id).stance === 'peace');
      if (peace) game.propose(peace, 'nap');
      else {
        const nap = others.find((id) => game.relation(factionId, id).stance === 'nap');
        if (nap && personality.aggression !== 'very-aggressive') game.propose(nap, 'alliance');
      }
    }
  } else if (personality.diplomacy === 'trader') {
    const partner = others.find((id) => {
      const rel = game.relation(factionId, id);
      return rel.stance !== 'war' && !rel.research;
    });
    if (partner) game.propose(partner, 'research');
  }
  const faction = game.state.factions[factionId];
  const owned = game.state.spies.filter((spy) => spy.owner === factionId);
  if (
    faction.credits > CONFIG.spies.recruitCost + 40 &&
    owned.length < 1 &&
    (personality.diplomacy === 'alone' || factionId === 'mnemosyne')
  ) {
    game.recruitSpy();
  }
  const idle = game.state.spies.find((spy) => spy.owner === factionId && !spy.host);
  if (idle && others[0]) game.placeSpy(idle.id, others[0]);
}
