import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { exposureOutcome } from '../src/core/geography';
import { defaultAxes } from '../src/core/factions';
import { makeRng } from '../src/core/rng';
import {
  attackerWins,
  baseCityCreditIncome,
  calendarForRound,
  combatOdds,
  evaluateVictory,
  planRoundOrder,
  rushBuyCost,
  shouldAutosave,
  statMultiplier,
  terraformFee,
  terraformTurns,
} from '../src/core/rules';

describe('combat odds', () => {
  it('compares attack to defense after the terrain modifier', () => {
    const odds = combatOdds(
      { attack: 4, defense: 1, hp: 10, maxHp: 10 },
      { defense: 2, attack: 1, hp: 10, maxHp: 10 },
      0.5,
    );
    expect(odds).toBeCloseTo(4 / 7, 5);
  });

  it('gives an unarmed attacker no chance and a helpless defender none', () => {
    expect(combatOdds({ attack: 0, defense: 1, hp: 10, maxHp: 10 }, { attack: 1, defense: 2, hp: 10, maxHp: 10 }, 0)).toBe(0);
    expect(combatOdds({ attack: 3, defense: 1, hp: 10, maxHp: 10 }, { attack: 1, defense: 0, hp: 10, maxHp: 10 }, 0)).toBe(1);
  });

  it('resolves a roll strictly below the odds as an attacker win', () => {
    expect(attackerWins(0.5, 0.49)).toBe(true);
    expect(attackerWins(0.5, 0.5)).toBe(false);
  });
});

describe('city credit income', () => {
  it('is one credit per population plus two', () => {
    expect(baseCityCreditIncome(1)).toBe(3);
    expect(baseCityCreditIncome(5)).toBe(7);
    expect(baseCityCreditIncome(5)).toBe(5 * CONFIG.economy.creditsPerPopulation + CONFIG.economy.creditsFlatPerCity);
  });
});

describe('rush-buy', () => {
  it('charges one credit per remaining point with a minimum of 10', () => {
    expect(rushBuyCost(0)).toBe(0);
    expect(rushBuyCost(1)).toBe(10);
    expect(rushBuyCost(10)).toBe(10);
    expect(rushBuyCost(11)).toBe(11);
    expect(rushBuyCost(40)).toBe(40);
  });
});

describe('terraforming fees and time', () => {
  it('scales the credit fee by biome', () => {
    expect(terraformFee('standard')).toBe(20);
    expect(terraformFee('thin-air')).toBe(30);
    expect(terraformFee('toxic')).toBe(35);
    expect(terraformFee('frozen')).toBe(40);
    expect(terraformFee('toxic')).toBeGreaterThan(terraformFee('standard'));
    expect(terraformFee('frozen')).toBe(CONFIG.terraform.baseFee * 2);
  });

  it('shortens projects as the terraformer tech level rises', () => {
    expect(terraformTurns('mine', 1)).toBe(6);
    expect(terraformTurns('mine', 2)).toBe(5);
    expect(terraformTurns('plant-trees', 3)).toBe(2);
    expect(terraformTurns('atmosphere', 3)).toBe(4);
    expect(terraformTurns('road', 3)).toBe(1);
  });
});

describe('harsh-ground damage', () => {
  it('deals the configured damage until the unit dies, leaves, or the faction is sealed', () => {
    expect(exposureOutcome(10, true, false, 5)).toEqual({ hp: 5, destroyed: false });
    expect(exposureOutcome(4, true, false, 5)).toEqual({ hp: -1, destroyed: true });
    expect(exposureOutcome(4, false, false, 5)).toEqual({ hp: 4, destroyed: false });
    expect(exposureOutcome(4, true, true, 5)).toEqual({ hp: 4, destroyed: false });
    expect(CONFIG.exposure.damagePerTurn).toBe(5);
  });
});

describe('turn order', () => {
  it('always puts the player first and shuffles every rival exactly once', () => {
    const rng = makeRng(7);
    const first = planRoundOrder('helm', ['verdantia', 'genesis', 'ironclad', 'mnemosyne', 'clio'], () => rng.next());
    const second = planRoundOrder('helm', ['verdantia', 'genesis', 'ironclad', 'mnemosyne', 'clio'], () => rng.next());
    expect(first[0]).toBe('helm');
    expect(second[0]).toBe('helm');
    expect(new Set(first)).toEqual(new Set(['helm', 'verdantia', 'genesis', 'ironclad', 'mnemosyne', 'clio']));
    expect(first.slice(1).join()).not.toBe(second.slice(1).join());
  });
});

describe('calendar', () => {
  it('starts at year 2460 week 1 and rolls the year after 52 weeks', () => {
    expect(calendarForRound(1)).toEqual({ year: 2460, week: 1 });
    expect(calendarForRound(52)).toEqual({ year: 2460, week: 52 });
    expect(calendarForRound(53)).toEqual({ year: 2461, week: 1 });
  });
});

describe('social axes', () => {
  it('gives +10% for each matching choice and nothing for a mismatch', () => {
    const axes = defaultAxes('helm');
    expect(statMultiplier('helm', axes, 'credits')).toBeCloseTo(1.2);
    expect(statMultiplier('helm', axes, 'minerals')).toBeCloseTo(1.1);
    expect(statMultiplier('helm', { ...axes, values: 'dominance' }, 'attack')).toBeCloseTo(1);
    expect(CONFIG.social.matchingBonus).toBe(0.1);
    expect(CONFIG.social.switchCost).toBe(100);
  });
});

describe('autosave cadence', () => {
  it('saves every 10 completed player turns when the toggle is on', () => {
    expect(shouldAutosave(0, true)).toBe(false);
    expect(shouldAutosave(9, true)).toBe(false);
    expect(shouldAutosave(10, true)).toBe(true);
    expect(shouldAutosave(20, false)).toBe(false);
  });
});

describe('allied victory', () => {
  it('lets an alliance share a win and otherwise requires one owner', () => {
    expect(evaluateVictory(['helm'], [], false)).toEqual({ kind: 'solo', factions: ['helm'] });
    expect(evaluateVictory(['helm', 'verdantia'], [['helm', 'verdantia']], false)).toBeNull();
    const allied = evaluateVictory(['helm', 'verdantia'], [['helm', 'verdantia']], true);
    expect(allied?.kind).toBe('alliance');
    expect(allied?.factions.sort()).toEqual(['helm', 'verdantia']);
  });
});
