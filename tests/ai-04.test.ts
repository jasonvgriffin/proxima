import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { runAi, wantsToFight } from '../src/core/ai';
import { isHostileClimate } from '../src/core/geography';
import { Game } from '../src/core/game';
import { starterDesigns } from '../src/core/parts';
import { peaceWindowFor } from '../src/core/personalities';
import { isSea } from '../src/core/rules';
import type { FactionId, Unit } from '../src/core/types';
import { runOneGame } from '../scripts/sim';

describe('0.4.0 AI and ship rules', () => {
  it('keeps the 0.3.0 wait after the peace window', () => {
    const quiet = peaceWindowFor('verdantia', 'normal');
    expect(wantsToFight('verdantia', 'normal', quiet)).toBe(false);
    expect(wantsToFight('verdantia', 'normal', quiet + 14)).toBe(false);
    expect(wantsToFight('verdantia', 'normal', quiet + 15)).toBe(true);

    const easyWindow = peaceWindowFor('verdantia', 'easy');
    expect(wantsToFight('verdantia', 'easy', easyWindow + 18)).toBe(false);
    expect(wantsToFight('verdantia', 'easy', easyWindow + 19)).toBe(true);

    const aggressive = peaceWindowFor('ironclad', 'normal');
    expect(wantsToFight('ironclad', 'normal', aggressive)).toBe(false);
    expect(wantsToFight('ironclad', 'normal', aggressive + 1)).toBe(true);
    const easyIron = peaceWindowFor('ironclad', 'easy');
    expect(wantsToFight('ironclad', 'easy', easyIron)).toBe(false);
    expect(wantsToFight('ironclad', 'easy', easyIron + 1)).toBe(true);
  });

  it('has a trader offer an exploration pact, and leaves Ironclad alone', () => {
    let signed = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const game = Game.newGame({ seed, player: 'helm', difficulty: 'normal', randomEvents: false });
      game.state.round = 5;
      game.state.factions.helm.isHuman = false;
      game.state.factions.verdantia.isHuman = false;
      game.state.whoseTurn = 'verdantia';
      const rel = game.relation('verdantia', 'helm');
      rel.contact = true;
      rel.stance = 'peace';
      rel.exploration = false;
      runAi(game);
      if (game.relation('verdantia', 'helm').exploration) signed += 1;
    }
    expect(signed).toBeGreaterThan(0);

    const ironclad = Game.newGame({ seed: 4, player: 'helm', difficulty: 'normal', randomEvents: false });
    ironclad.state.round = 5;
    ironclad.state.factions.helm.isHuman = false;
    ironclad.state.factions.ironclad.isHuman = false;
    ironclad.state.whoseTurn = 'ironclad';
    const alone = ironclad.relation('ironclad', 'helm');
    alone.contact = true;
    alone.stance = 'peace';
    alone.exploration = false;
    runAi(ironclad);
    expect(ironclad.relation('ironclad', 'helm').exploration).toBe(false);
  });

  it('holds a finished ship when every nearby sea tile is taken, and launches onto the open one', () => {
    const blocked = Game.newGame({ seed: 40, player: 'helm', randomEvents: false, autosaveEnabled: false });
    const site = coastSite(blocked);
    expect(site).toBeTruthy();
    const settler = blocked.unitsOf('helm').find((unit) => unit.canFound)!;
    settler.x = site!.x;
    settler.y = site!.y;
    expect(blocked.foundCity(settler.id).ok).toBe(true);
    const city = blocked.citiesOf('helm')[0];
    const seas = seaInRadius(blocked, city.x, city.y, 8);
    expect(seas.length).toBeGreaterThan(1);
    occupySeas(blocked, seas);
    const before = blocked.unitsOf('helm').filter((unit) => unit.domain === 'sea').length;
    city.production = { designId: 'landing-barge', progress: 500, cost: 20 };
    resolveEconomy(blocked, 'helm');
    expect(blocked.unitsOf('helm').filter((unit) => unit.domain === 'sea').length).toBe(before);
    expect(city.production?.designId).toBe('landing-barge');
    expect(city.production?.progress).toBeGreaterThanOrEqual(city.production?.cost ?? 0);

    const open = Game.newGame({ seed: 40, player: 'helm', randomEvents: false, autosaveEnabled: false });
    const landing = coastSite(open);
    const pod = open.unitsOf('helm').find((unit) => unit.canFound)!;
    pod.x = landing!.x;
    pod.y = landing!.y;
    expect(open.foundCity(pod.id).ok).toBe(true);
    const portCity = open.citiesOf('helm')[0];
    const water = seaInRadius(open, portCity.x, portCity.y, 8);
    const free = nearestEmptySea(open, portCity.x, portCity.y, water);
    expect(free).toBeTruthy();
    occupySeas(open, water, free!);
    const seaBefore = open.unitsOf('helm').filter((unit) => unit.domain === 'sea').map((unit) => unit.id);
    portCity.production = { designId: 'landing-barge', progress: 20, cost: 20 };
    resolveEconomy(open, 'helm');
    const launched = open.unitsOf('helm').filter((unit) => unit.domain === 'sea' && !seaBefore.includes(unit.id));
    expect(launched).toHaveLength(1);
    expect(launched[0].x).toBe(free!.x);
    expect(launched[0].y).toBe(free!.y);
    expect(open.state.units.filter((unit) => unit.aboard == null && unit.x === free!.x && unit.y === free!.y)).toHaveLength(1);
  });

  it('finishes hard seed 1086 instead of sitting on two empires', () => {
    const record = runOneGame({
      seed: 1086,
      difficulty: 'hard',
      events: false,
      allied: false,
      playerSeat: 'genesis',
      maxTurns: 400,
      stallRounds: 40,
    });
    expect(record.issues.filter((issue) => issue.includes('share'))).toEqual([]);
    expect(record.status).toBe('finished');
    expect(record.turns).toBeLessThan(400);
    expect(record.winner.length).toBe(1);
  }, 180000);
});

function resolveEconomy(game: Game, factionId: FactionId): void {
  (game as unknown as { resolveEconomy(id: FactionId): void }).resolveEconomy(factionId);
}

function coastSite(game: Game): { x: number; y: number } | null {
  for (let y = 0; y < game.state.height; y++) {
    for (let x = 0; x < game.state.width; x++) {
      const tile = game.tile(x, y);
      if (isSea(tile.terrain) || isHostileClimate(tile.terrain) || game.cityAt(x, y)) continue;
      if (game.nearestCityDistance(x, y) < CONFIG.city.minDistance) continue;
      if (seaInRadius(game, x, y, 8).length < 2) continue;
      return { x, y };
    }
  }
  return null;
}

function seaInRadius(game: Game, x: number, y: number, radius: number): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!game.inBounds(nx, ny) || !isSea(game.tile(nx, ny).terrain)) continue;
      tiles.push({ x: nx, y: ny });
    }
  }
  return tiles;
}

function nearestEmptySea(
  game: Game,
  x: number,
  y: number,
  seas: { x: number; y: number }[],
): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (const tile of seas) {
    if (game.state.units.some((unit) => unit.aboard == null && unit.x === tile.x && unit.y === tile.y)) continue;
    const d = Math.max(Math.abs(tile.x - x), Math.abs(tile.y - y));
    if (!best || d < best.d) best = { x: tile.x, y: tile.y, d };
  }
  return best ? { x: best.x, y: best.y } : null;
}

function occupySeas(game: Game, seas: { x: number; y: number }[], except?: { x: number; y: number }): void {
  const design = starterDesigns().find((entry) => entry.id === 'landing-barge');
  if (!design) throw new Error('missing landing barge');
  for (const tile of seas) {
    if (except && tile.x === except.x && tile.y === except.y) continue;
    if (game.state.units.some((unit) => unit.aboard == null && unit.x === tile.x && unit.y === tile.y)) continue;
    pushShip(game, design, 'ironclad', tile.x, tile.y);
  }
}

function pushShip(game: Game, design: ReturnType<typeof starterDesigns>[number], factionId: FactionId, x: number, y: number): Unit {
  const unit: Unit = {
    id: game.state.nextUnitId++,
    factionId,
    designId: design.id,
    name: design.name,
    x,
    y,
    hp: design.hp,
    maxHp: design.hp,
    movesLeft: 0,
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
    transport: design.transport,
    cargo: [],
    aboard: null,
  };
  game.state.units.push(unit);
  return unit;
}
