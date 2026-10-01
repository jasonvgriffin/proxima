import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { crisisTuning } from '../src/core/difficulty';
import {
  acceptanceChance,
  blocksAttack,
  canOfferTreaty,
  canSetStance,
  downgradeStance,
  sharesMaps,
} from '../src/core/diplomacy';
import { frameBlame, missionCaught, spyMaintenancePerTurn } from '../src/core/spies';
import { Game } from '../src/core/game';
import { evaluateVictory } from '../src/core/rules';

describe('diplomacy ladder', () => {
  it('steps from war to peace to a pact to an alliance, and not the other way around', () => {
    expect(canSetStance('war', 'alliance').ok).toBe(false);
    expect(canSetStance('peace', 'alliance').ok).toBe(false);
    expect(canSetStance('war', 'peace').ok).toBe(true);
    expect(canSetStance('peace', 'nap').ok).toBe(true);
    expect(canSetStance('nap', 'alliance').ok).toBe(true);
    expect(canSetStance('alliance', 'war').ok).toBe(true);
    expect(canOfferTreaty('war').ok).toBe(false);
    expect(canOfferTreaty('peace').ok).toBe(true);
    expect(blocksAttack('nap')).toBe(true);
    expect(blocksAttack('alliance')).toBe(true);
    expect(blocksAttack('peace')).toBe(false);
    expect(downgradeStance('alliance')).toBe('nap');
    expect(sharesMaps({ stance: 'alliance', exploration: false })).toBe(true);
    expect(sharesMaps({ stance: 'peace', exploration: true })).toBe(true);
    expect(sharesMaps({ stance: 'peace', exploration: false })).toBe(false);
  });

  it('makes treaty-seekers more likely to accept, and a grievance less likely', () => {
    const warm = acceptanceChance({
      kind: 'nap',
      diplomacy: 'treaty',
      aggression: 'easy',
      memory: 0,
      axisMatches: 4,
    });
    const cold = acceptanceChance({
      kind: 'nap',
      diplomacy: 'alone',
      aggression: 'very-aggressive',
      memory: 80,
      axisMatches: 0,
    });
    expect(warm).toBeGreaterThan(cold);
  });

  it('refuses attacks under a pact and lets a declaration of war break treaties', () => {
    const game = Game.newGame({ seed: 19, player: 'helm' });
    const rel = game.relation('helm', 'verdantia');
    rel.contact = true;
    rel.stance = 'peace';
    const pact = game.propose('verdantia', 'nap', true);
    expect(pact.ok).toBe(true);
    expect(game.relation('helm', 'verdantia').stance).toBe('nap');
    const scout = game.unitsOf('helm').find((unit) => unit.attack > 0)!;
    const foe = game.unitsOf('verdantia')[0];
    foe.x = scout.x + 1;
    foe.y = scout.y;
    const tile = game.tile(foe.x, foe.y);
    tile.terrain = 'grass';
    tile.scarred = false;
    const blocked = game.confirmAttack(scout.id, foe.x, foe.y);
    expect(blocked.ok).toBe(false);
    expect(game.relation('helm', 'verdantia').stance).toBe('nap');
    game.relation('helm', 'verdantia').research = true;
    const war = game.propose('verdantia', 'war');
    expect(war.ok).toBe(true);
    expect(game.relation('helm', 'verdantia').stance).toBe('war');
    expect(game.relation('helm', 'verdantia').research).toBe(false);
  });
});

describe('spy networks', () => {
  it('charges a recruit fee once and never a maintenance fee', () => {
    expect(spyMaintenancePerTurn()).toBe(0);
    expect(CONFIG.spies.maintenance).toBe(0);
    const game = Game.newGame({ seed: 6, player: 'mnemosyne' });
    const before = game.state.factions.mnemosyne.credits;
    const recruited = game.recruitSpy();
    expect(recruited.ok).toBe(true);
    expect(game.state.factions.mnemosyne.credits).toBe(before - CONFIG.spies.recruitCost);
    const placed = game.placeSpy(game.state.spies[0].id, 'helm');
    expect(placed.ok).toBe(true);
    expect(game.intel('helm')?.techs).toContain('governance');
    expect(game.mapPartners('mnemosyne')).toContain('helm');
    const afterPlace = game.state.factions.mnemosyne.credits;
    game.endTurn();
    const spentOnSpies = afterPlace - game.state.factions.mnemosyne.credits;
    expect(spentOnSpies).toBeLessThan(CONFIG.spies.recruitCost);
    const stillThere = game.state.spies.some((spy) => spy.owner === 'mnemosyne');
    const rootedOut = game.state.log.some((line) => line.text.includes('roots out a spy'));
    expect(stillThere || rootedOut).toBe(true);
  });

  it('catches a thief on a low roll and lets a high roll steal the tech', () => {
    expect(missionCaught(0.1, CONFIG.spies.theftCatch)).toBe(true);
    expect(missionCaught(0.9, CONFIG.spies.theftCatch)).toBe(false);
    const game = Game.newGame({ seed: 2, player: 'helm' });
    game.recruitSpy();
    const spy = game.state.spies[0];
    game.placeSpy(spy.id, 'ironclad');
    game.state.factions.ironclad.techs.push('coil-weapons');
    const caught = game.resolveTheft(spy.id, 'coil-weapons', 0.01);
    expect(caught.ok).toBe(false);
    expect(game.state.factions.helm.techs).not.toContain('coil-weapons');
    expect(game.state.spies.some((entry) => entry.id === spy.id)).toBe(false);
    game.state.factions.helm.credits = 200;
    game.recruitSpy();
    const next = game.state.spies.find((entry) => entry.owner === 'helm')!;
    game.placeSpy(next.id, 'ironclad');
    const stolen = game.resolveTheft(next.id, 'coil-weapons', 0.99);
    expect(stolen.ok).toBe(true);
    expect(game.state.factions.helm.techs).toContain('coil-weapons');
  });

  it('frames two other factions, or exposes the owner if the spy is caught', () => {
    const clean = frameBlame(false);
    const burned = frameBlame(true);
    expect(clean.betweenTargets).toBe(CONFIG.spies.frameMemory);
    expect(clean.againstOwner).toBe(0);
    expect(burned.againstOwner).toBe(CONFIG.spies.caughtMemory);
    expect(burned.betweenTargets).toBe(0);

    const game = Game.newGame({ seed: 9, player: 'clio' });
    game.recruitSpy();
    game.placeSpy(game.state.spies[0].id, 'helm');
    game.relation('verdantia', 'genesis').stance = 'alliance';
    const framed = game.resolveFrame(game.state.spies[0].id, 'verdantia', 'genesis', 0.99);
    expect(framed.ok).toBe(true);
    expect(game.relation('verdantia', 'genesis').memory).toBeGreaterThanOrEqual(CONFIG.spies.frameMemory);
    expect(game.relation('verdantia', 'genesis').stance).not.toBe('alliance');
    expect(game.relation('clio', 'verdantia').memory).toBe(0);
  });

  it('roots out enemy spies on a successful sweep', () => {
    const game = Game.newGame({ seed: 12, player: 'helm' });
    game.state.whoseTurn = 'ironclad';
    game.recruitSpy();
    const spy = game.state.spies[0];
    game.placeSpy(spy.id, 'helm');
    game.state.whoseTurn = 'helm';
    const swept = game.resolveSweep(0);
    expect(swept.removed).toBe(1);
    expect(game.state.spies.some((entry) => entry.id === spy.id)).toBe(false);
    game.state.whoseTurn = 'verdantia';
    game.recruitSpy();
    game.placeSpy(game.state.spies[0].id, 'helm');
    game.state.whoseTurn = 'helm';
    const missed = game.resolveSweep(0.99);
    expect(missed.removed).toBe(0);
    expect(game.state.spies).toHaveLength(1);
  });
});

describe('the waking reactor', () => {
  it('stays quiet until the configured week, then ramps damage, tithe, and yield loss', () => {
    const quiet = crisisTuning(CONFIG.crisis.startRound - 1, 'normal');
    const warning = crisisTuning(CONFIG.crisis.startRound, 'normal');
    const full = crisisTuning(CONFIG.crisis.startRound + CONFIG.crisis.rampRounds, 'normal');
    expect(quiet.level).toBe(0);
    expect(warning.level).toBe(0);
    expect(warning.startRound).toBe(CONFIG.crisis.startRound);
    expect(full.level).toBe(1);
    expect(full.damage).toBe(CONFIG.crisis.maxPulseDamage);
    expect(full.tithe).toBe(CONFIG.crisis.creditTithe);
    expect(full.yieldFactor).toBeCloseTo(1 - CONFIG.crisis.maxYieldPenalty);
  });

  it('warns on the first crisis week and later hurts unanchored units', () => {
    const game = Game.newGame({ seed: 14, player: 'helm' });
    game.state.round = CONFIG.crisis.startRound - 1;
    game.endTurn();
    expect(game.state.log.some((entry) => entry.text.includes('Waking Reactor'))).toBe(true);
    const scout = game.unitsOf('helm').find((unit) => unit.role === 'scout')!;
    const before = scout.hp;
    const tile = game.tile(scout.x, scout.y);
    tile.improvement = null;
    tile.scarred = false;
    game.state.round = CONFIG.crisis.startRound + CONFIG.crisis.rampRounds - 1;
    game.endTurn();
    const after = game.unitById(scout.id);
    expect(after).toBeTruthy();
    expect(after!.hp).toBeLessThan(before);
  });
});

describe('victory waits for rivals who can still found', () => {
  it('does not end the game on the first city while other colony pods exist', () => {
    expect(evaluateVictory(['helm'], [], false, ['verdantia'])).toBeNull();
    expect(evaluateVictory(['helm'], [], false, [])).toEqual({ kind: 'solo', factions: ['helm'] });
    const game = Game.newGame({ seed: 3, player: 'helm' });
    const settler = game.unitsOf('helm').find((unit) => unit.canFound)!;
    expect(game.foundCity(settler.id).ok).toBe(true);
    expect(game.state.winner).toBeNull();
  });
});
