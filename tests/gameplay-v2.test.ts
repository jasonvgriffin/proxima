import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { acceptsTrade } from '../src/core/diplomacy';
import { Game } from '../src/core/game';
import { starterDesigns } from '../src/core/parts';
import { factionEliminated, isSea, projectMakesLivable, unitUpkeep } from '../src/core/rules';
import { FACTION_IDS, type Difficulty, type FactionId, type Unit } from '../src/core/types';

function newGame(seed = 4) {
  return Game.newGame({ seed, player: 'helm' });
}

describe('livable ground', () => {
  it('treats only atmosphere as a project that opens founding', () => {
    expect(projectMakesLivable('atmosphere')).toBe(true);
    expect(projectMakesLivable('farm')).toBe(false);
    expect(projectMakesLivable('road')).toBe(false);
    expect(projectMakesLivable('mine')).toBe(false);
    expect(projectMakesLivable('solar')).toBe(false);
  });
});

describe('resource sinks', () => {
  it('charges unit upkeep in credits and stockpiled minerals and nutrients', () => {
    const game = newGame(18);
    const helm = game.state.factions.helm;
    const before = { credits: helm.credits, minerals: helm.minerals, nutrients: helm.nutrients };
    const units = game.unitsOf('helm');
    const creditCost = units.reduce((sum, unit) => sum + unitUpkeep(unit.role), 0);
    expect(creditCost).toBeGreaterThan(0);
    game.endTurn();
    expect(game.state.factions.helm.credits).toBe(before.credits - creditCost);
    expect(game.state.factions.helm.minerals).toBe(before.minerals - units.length * CONFIG.upkeep.minerals);
    expect(game.state.factions.helm.nutrients).toBe(before.nutrients - units.length * CONFIG.upkeep.nutrients);
  });

  it('spends stockpiles as well as credits on a rush', () => {
    const game = newGame(4);
    const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
    game.foundCity(settler.id);
    const city = game.citiesOf('helm')[0];
    game.setProduction(city.id, 'line-infantry');
    const left = 4;
    city.production!.progress = city.production!.cost - left;
    const before = { ...game.state.factions.helm };
    const rushed = game.rushBuy(city.id);
    expect(rushed.ok).toBe(true);
    expect(game.state.factions.helm.credits).toBe(before.credits - 10);
    expect(game.state.factions.helm.minerals).toBe(before.minerals - left);
    expect(game.state.factions.helm.nutrients).toBe(before.nutrients - left);
    expect(game.state.factions.helm.energy).toBe(before.energy - left);
  });

  it('lets a grievance fade by one point each week', () => {
    const game = newGame(9);
    game.relation('helm', 'ironclad').memory = 12;
    game.endTurn();
    expect(game.relation('helm', 'ironclad').memory).toBe(12 - CONFIG.diplomacy.memoryDecay);
  });
});

describe('defeat', () => {
  it('ends the player when no city and no colony pod remain', () => {
    expect(factionEliminated(0, [])).toBe(true);
    expect(factionEliminated(0, [{ canFound: true }])).toBe(false);
    expect(factionEliminated(1, [])).toBe(false);
    const game = newGame(13);
    game.state.units = game.state.units.filter((unit) => unit.factionId !== 'helm');
    game.endTurn();
    expect(game.state.playerDefeated).toBe(true);
    expect(game.state.eliminated).toContain('helm');
    expect(game.state.log.some((entry) => entry.text.includes('is eliminated'))).toBe(true);
    expect(game.endTurn().ok).toBe(false);
  });
});

describe('random events', () => {
  it('stays quiet when the option is off, and repeats the same rolls from a save', () => {
    const quiet = Game.newGame({ seed: 21, player: 'helm', randomEvents: false });
    quiet.state.round = 40;
    quiet.state.events.nextRollRound = 1;
    quiet.endTurn();
    expect(quiet.state.events.prompt).toBeNull();
    expect(quiet.state.events.pending).toBeNull();
    expect(quiet.state.log.some((entry) => entry.text.includes('solar flare') || entry.text.includes('dust'))).toBe(false);

    const play = (seed: number) => {
      const game = Game.newGame({ seed, player: 'helm', randomEvents: true });
      const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
      game.foundCity(settler.id);
      const city = game.citiesOf('helm')[0];
      const infantry = starterDesigns().find((entry) => entry.name === 'Line Infantry')!;
      pushUnit(game, infantry, 'helm', city.x, city.y);
      pushUnit(game, infantry, 'helm', city.x, city.y);
      game.state.factions.helm.credits = 400;
      game.state.factions.helm.minerals = 80;
      game.state.factions.helm.nutrients = 80;
      const seen: string[] = [];
      for (let n = 0; n < 36; n++) {
        const turned = game.endTurn();
        if (!turned.ok && game.state.events.prompt) {
          seen.push(game.state.events.prompt.kind);
          game.state.factions.helm.energy = 40;
          game.state.factions.helm.minerals = 40;
          expect(game.chooseEvent(game.state.events.prompt.choices[0].id).ok).toBe(true);
        } else if (game.state.events.pending) seen.push(`warn:${game.state.events.pending.kind}`);
      }
      return { seen, state: game.serialize() };
    };
    const first = play(21);
    const second = play(21);
    expect(first.seen.length).toBeGreaterThan(0);
    expect(second.seen).toEqual(first.seen);
    const restored = Game.fromState(first.state);
    expect(restored.state.events.nextRollRound).toBe(first.state.events.nextRollRound);
    expect(restored.state.events.pending).toEqual(first.state.events.pending);
    expect(restored.state.setup.randomEvents).toBe(true);
  });
});

describe('transports and bombardment', () => {
  it('loads and unloads on a coastal tile, up to the design capacity', () => {
    const game = newGame(16);
    const design = starterDesigns().find((entry) => entry.name === 'Troop Transport')!;
    expect(design.transport).toBeGreaterThan(0);
    const passenger = game.unitsOf('helm').find((unit) => unit.domain === 'land')!;
    const coast = coastalPair(game);
    expect(coast).toBeTruthy();
    passenger.x = coast!.x;
    passenger.y = coast!.y;
    const ship = pushUnit(game, design, 'helm', coast!.sx, coast!.sy);
    const loaded = game.loadUnit(ship.id, passenger.id);
    expect(loaded.ok).toBe(true);
    expect(passenger.aboard).toBe(ship.id);
    expect(ship.cargo).toContain(passenger.id);
    expect(game.reachable(passenger.id).size).toBe(0);
    const drop = game.coastalDrops(ship.id)[0];
    ship.movesLeft = design.moves;
    const ashore = game.unloadUnit(ship.id, passenger.id, drop.x, drop.y);
    expect(ashore.ok).toBe(true);
    expect(passenger.aboard).toBeNull();
    expect(passenger.x).toBe(drop.x);
  });

  it('marks shore fire against a land unit or a city as naval bombardment', () => {
    const game = newGame(17);
    const cutter = starterDesigns().find((entry) => entry.name === 'Troop Cutter')!;
    expect(cutter.attack).toBeGreaterThan(0);
    const coast = coastalPair(game);
    const foe = game.unitsOf('verdantia').find((unit) => unit.domain === 'land')!;
    foe.x = coast!.x;
    foe.y = coast!.y;
    const ship = pushUnit(game, cutter, 'helm', coast!.sx, coast!.sy);
    const preview = game.previewAttack(ship.id, foe.x, foe.y);
    expect(preview.ok).toBe(true);
    expect(preview.navalBombardment).toBe(true);
    expect(preview.city).toBe(false);
  });
});

describe('trade', () => {
  it('refuses wartime deals, accepts a gift, and moves stockpiles when the margin is fair', () => {
    expect(acceptsTrade({ diplomacy: 'trader', memory: 0, stance: 'war', offered: 20, asked: 5 })).toBe(false);
    expect(acceptsTrade({ diplomacy: 'treaty', memory: 0, stance: 'peace', offered: 8, asked: 0 })).toBe(true);
    expect(acceptsTrade({ diplomacy: 'alone', memory: 0, stance: 'peace', offered: 10, asked: 10 })).toBe(false);
    const game = newGame(19);
    game.relation('helm', 'verdantia').contact = true;
    game.state.factions.helm.minerals = 30;
    const energyBefore = game.state.factions.helm.energy;
    game.state.factions.verdantia.energy = 30;
    const agreed = game.proposeTrade(
      'verdantia',
      { credits: 0, minerals: 10, nutrients: 0, energy: 0, tech: null },
      { credits: 0, minerals: 0, nutrients: 0, energy: 8, tech: null },
    );
    expect(agreed.ok).toBe(true);
    expect(game.state.factions.helm.minerals).toBe(20);
    expect(game.state.factions.helm.energy).toBe(energyBefore + 8);
    expect(game.state.factions.verdantia.minerals).toBeGreaterThan(0);
  });
});

describe('rival AI', () => {
  it('founds extra cities, goes to war, and produces a winner', () => {
    const seeds = [11, 29, 47];
    const levels: Difficulty[] = ['easy', 'normal', 'brutal'];
    const reports: string[] = [];
    for (const difficulty of levels) {
      for (const seed of seeds) {
        const game = Game.newGame({ seed, player: 'helm', difficulty, randomEvents: false });
        let wars = false;
        let extraCities = false;
        const peak = new Map<FactionId, number>();
        let spyMissions = 0;
        for (let n = 0; n < 300 && !game.state.winner; n++) {
          const logAt = game.state.log.length;
          game.simulateAllAiRound();
          for (const line of game.state.log.slice(logAt)) {
            if (line.text.startsWith('Stolen from') || line.text.includes('catches a thief') || line.text.includes('sabotage') || line.text.includes('Counterintelligence')) {
              spyMissions += 1;
            }
          }
          if (game.state.relations.some((rel) => rel.stance === 'war')) wars = true;
          for (const id of FACTION_IDS) {
            const count = game.citiesOf(id).length;
            peak.set(id, Math.max(peak.get(id) ?? 0, count));
            if (count >= 2) extraCities = true;
          }
        }
        const best = Math.max(...peak.values());
        const winner = game.state.winner ? game.state.winner.factions.join('+') : 'none';
        reports.push(
          `${difficulty} seed ${seed}: round ${game.state.round}, cities peak ${best}, wars ${wars}, spies ${spyMissions}, winner ${winner}`,
        );
        console.log(reports.at(-1));
        expect(extraCities, reports.at(-1)).toBe(true);
        expect(wars, reports.at(-1)).toBe(true);
        expect(game.state.winner, reports.at(-1)).toBeTruthy();
        expect(game.state.round).toBeLessThanOrEqual(301);
      }
    }
    console.log(reports.join('\n'));
  }, 300000);
});

function coastalPair(game: Game): { x: number; y: number; sx: number; sy: number } | null {
  for (let y = 0; y < game.state.height; y++) {
    for (let x = 0; x < game.state.width; x++) {
      if (isSea(game.tile(x, y).terrain)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const sx = x + dx;
          const sy = y + dy;
          if (!game.inBounds(sx, sy) || !isSea(game.tile(sx, sy).terrain)) continue;
          return { x, y, sx, sy };
        }
      }
    }
  }
  return null;
}

function pushUnit(game: Game, design: ReturnType<typeof starterDesigns>[number], factionId: FactionId, x: number, y: number): Unit {
  const unit: Unit = {
    id: game.state.nextUnitId++,
    factionId,
    designId: design.id,
    name: design.name,
    x,
    y,
    hp: design.hp,
    maxHp: design.hp,
    movesLeft: design.moves,
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
