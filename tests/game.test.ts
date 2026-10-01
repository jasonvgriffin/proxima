import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/core/game';
import { FACTION_IDS } from '../src/core/types';
import { isSea, zoneForColumn } from '../src/core/rules';

function newGame(seed = 3) {
  return Game.newGame({
    seed,
    player: 'helm',
    difficulty: 'normal',
    alliedVictory: false,
    randomEvents: false,
    autosaveEnabled: true,
  });
}

describe('a new game', () => {
  it('starts every faction in the twilight band with a colony, a terraformer, and a scout', () => {
    const game = newGame();
    expect(game.calendar()).toMatchObject({ year: 2460, week: 1 });
    expect(game.state.whoseTurn).toBe('helm');
    for (const id of FACTION_IDS) {
      const units = game.unitsOf(id);
      expect(units.some((unit) => unit.canFound)).toBe(true);
      expect(units.some((unit) => unit.canTerraform)).toBe(true);
      const home = units[0];
      const tile = game.tile(home.x, home.y);
      expect(tile.zone).toBe('twilight');
      expect(zoneForColumn(home.x)).toBe('twilight');
      expect(isSea(tile.terrain)).toBe(false);
    }
  });

  it('founds a city with a colony pod and refuses the day side without sealed habitats', () => {
    const game = newGame(11);
    const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
    const founded = game.foundCity(settler.id);
    expect(founded.ok).toBe(true);
    expect(game.unitById(settler.id)).toBeUndefined();
    expect(game.citiesOf('helm')).toHaveLength(1);

    const other = Game.newGame({ seed: 11, player: 'helm' });
    const pod = other.unitsOf('helm').find((unit) => unit.canFound)!;
    pod.x = 1;
    const tile = other.tile(1, pod.y);
    tile.terrain = 'scorched';
    tile.zone = 'day';
    tile.livable = false;
    const denied = other.foundCity(pod.id);
    expect(denied.ok).toBe(false);
    other.state.factions.helm.techs.push('sealed-habitats');
    const allowed = other.foundCity(pod.id);
    expect(allowed.ok).toBe(true);
  });

  it('charges a biome fee and keeps one terraformer on the tile without making a farm livable', () => {
    const game = newGame(5);
    const former = game.unitsOf('helm').find((unit) => unit.canTerraform)!;
    const tile = game.tile(former.x, former.y);
    tile.terrain = 'toxic';
    tile.zone = 'day';
    tile.livable = false;
    const before = game.state.factions.helm.credits;
    const started = game.startTerraform(former.id, 'farm');
    expect(started.ok).toBe(true);
    expect(game.state.factions.helm.credits).toBe(before - 35);
    expect(former.terraform?.total).toBe(3);
    const blocked = game.moveUnit(former.id, former.x, Math.min(game.state.height - 1, former.y + 1));
    expect(blocked.ok).toBe(false);
    const second = game.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    second.x = former.x;
    second.y = former.y;
    second.canTerraform = true;
    const crowded = game.startTerraform(second.id, 'mine');
    expect(crowded.ok).toBe(false);
    former.terraform!.turnsLeft = 1;
    game.endTurn();
    const updated = game.tile(former.x, former.y);
    expect(updated.livable).toBe(false);
    expect(updated.improvement).toBe('farm');
  });

  it('only atmosphere work pulls a tile into the livable zone', () => {
    const game = newGame(6);
    const former = game.unitsOf('helm').find((unit) => unit.canTerraform)!;
    const tile = game.tile(former.x, former.y);
    tile.terrain = 'scorched';
    tile.zone = 'day';
    tile.livable = false;
    game.state.factions.helm.techs.push('atmosphere');
    const started = game.startTerraform(former.id, 'atmosphere');
    expect(started.ok).toBe(true);
    former.terraform!.turnsLeft = 1;
    game.endTurn();
    expect(game.tile(former.x, former.y).livable).toBe(true);
    expect(game.tile(former.x, former.y).improvement).toBe('atmosphere');
  });

  it('damages units left outside the band and stops after Sealed Habitats', () => {
    const game = newGame(8);
    const scout = game.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    scout.x = 0;
    const tile = game.tile(0, scout.y);
    tile.livable = false;
    tile.zone = 'day';
    tile.terrain = 'scorched';
    const hp = scout.hp;
    game.endTurn();
    const survived = game.unitById(scout.id);
    expect(survived?.hp).toBe(hp - CONFIG.outsideBand.damagePerTurn);

    const sealed = newGame(8);
    const unit = sealed.unitsOf('helm').find((entry) => entry.role === 'scout')!;
    unit.x = 0;
    const harsh = sealed.tile(0, unit.y);
    harsh.livable = false;
    harsh.zone = 'day';
    harsh.terrain = 'scorched';
    sealed.state.factions.helm.techs.push('sealed-habitats');
    const before = unit.hp;
    sealed.endTurn();
    expect(sealed.unitById(unit.id)?.hp).toBe(before);
  });

  it('runs the player first and a full shuffled AI round with no turn limit', () => {
    const game = newGame(21);
    expect(game.state.round).toBe(1);
    const ended = game.endTurn();
    expect(ended.ok).toBe(true);
    expect(ended.aiOrder).toHaveLength(5);
    expect(ended.aiOrder).not.toContain('helm');
    expect(new Set(ended.aiOrder).size).toBe(5);
    expect(game.state.round).toBe(2);
    expect(game.state.whoseTurn).toBe('helm');
    expect(game.calendar().week).toBe(2);
    const again = game.endTurn();
    expect(again.aiOrder.join(',')).not.toBe('');
    expect(game.state.round).toBe(3);
  });

  it('switches a social axis for 100 credits and a stability hit', () => {
    const game = newGame(2);
    game.state.factions.helm.credits = 150;
    const changed = game.setSocial('values', 'dominance');
    expect(changed.ok).toBe(true);
    expect(game.state.factions.helm.credits).toBe(50);
    expect(game.state.factions.helm.stabilityTurns).toBe(CONFIG.social.stabilityHitTurns);
    game.state.factions.helm.credits = 40;
    const broke = game.setSocial('economy', 'market');
    expect(broke.ok).toBe(false);
    expect(game.state.factions.helm.axes.economy).not.toBe('market');
  });

  it('rush-buys for one credit per remaining point, minimum 10', () => {
    const game = newGame(4);
    const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
    game.foundCity(settler.id);
    const city = game.citiesOf('helm')[0];
    game.setProduction(city.id, 'scout-walker');
    city.production!.progress = city.production!.cost - 4;
    const before = game.state.factions.helm.credits;
    const rushed = game.rushBuy(city.id);
    expect(rushed.ok).toBe(true);
    expect(game.state.factions.helm.credits).toBe(before - 10);
    expect(game.unitsOf('helm').some((unit) => unit.name === 'Scout Walker' && unit.x === city.x)).toBe(true);
  });

  it('round-trips through a save', () => {
    const game = newGame(15);
    const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
    game.foundCity(settler.id);
    game.endTurn();
    const raw = game.serialize();
    const restored = Game.fromState(raw);
    expect(restored.state.round).toBe(game.state.round);
    expect(restored.state.cities.map((city) => city.name)).toEqual(game.state.cities.map((city) => city.name));
    expect(restored.state.factions.helm.credits).toBe(game.state.factions.helm.credits);
    expect(restored.state.rngState).toBe(game.state.rngState);
    expect(restored.unitsOf('helm').map((unit) => unit.id).sort()).toEqual(game.unitsOf('helm').map((unit) => unit.id).sort());
  });
});
