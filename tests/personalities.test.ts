import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/factions';
import { FACTION_AI, factionAi } from '../src/core/personalities';
import { FACTION_IDS } from '../src/core/types';

describe('faction AI table', () => {
  it('returns the shipped row when the personality is unchanged', () => {
    for (const id of FACTION_IDS) {
      expect(factionAi(id)).toBe(FACTION_AI[id]);
      expect(factionAi(id, FACTIONS[id].personality)).toEqual(FACTION_AI[id]);
    }
  });

  it('changes only the trait a player edited', () => {
    const tuned = factionAi('helm', { ...FACTIONS.helm.personality, risk: 'bold' });
    expect(tuned.oddsThreshold).toBe(0.3);
    expect(tuned.cityTarget).toBe(FACTION_AI.helm.cityTarget);
    expect(tuned.peaceWindow).toBe(FACTION_AI.helm.peaceWindow);
    expect(tuned.boldAttacks).toBe(true);
  });
});
