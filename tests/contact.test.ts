import { describe, expect, it } from 'vitest';
import { runAi } from '../src/core/ai';
import { seesFaction } from '../src/core/contact';
import { Game } from '../src/core/game';

describe('faction contact', () => {
  it('asks visibility through one function', () => {
    const seen = seesFaction(
      'helm',
      'verdantia',
      [{ factionId: 'verdantia', x: 4, y: 4 }],
      (viewer, x, y) => viewer === 'helm' && x === 4 && y === 4,
    );
    expect(seen).toBe(true);
    expect(seesFaction('helm', 'helm', [{ factionId: 'helm', x: 4, y: 4 }], () => true)).toBe(false);
    expect(seesFaction('helm', 'verdantia', [{ factionId: 'ironclad', x: 4, y: 4 }], () => true)).toBe(false);
  });

  it('blocks diplomacy until a unit is seen, then remembers the meeting', () => {
    const game = Game.newGame({ seed: 3, player: 'helm' });
    for (const rel of game.state.relations) rel.contact = false;
    const home = game.unitsOf('helm')[0];
    for (const unit of game.state.units) {
      if (unit.factionId !== 'helm') {
        unit.x = 1;
        unit.y = 1;
      }
    }
    expect(game.propose('verdantia', 'nap').ok).toBe(false);
    expect(game.propose('verdantia', 'nap').message).toMatch(/No contact/);
    expect(game.propose('verdantia', 'war').ok).toBe(false);

    const foe = game.unitsOf('verdantia')[0];
    foe.x = home.x + 1;
    foe.y = home.y;
    expect(game.fogState('helm', foe.x, foe.y)).toBe(2);
    expect(game.inContact('helm', 'verdantia')).toBe(true);

    foe.x = 1;
    foe.y = 1;
    expect(game.fogState('helm', foe.x, foe.y)).toBe(0);
    expect(game.inContact('helm', 'verdantia')).toBe(true);
    expect(game.propose('verdantia', 'nap', true).ok).toBe(true);
  });

  it('does not count remembered ground as a meeting', () => {
    const game = Game.newGame({ seed: 3, player: 'helm' });
    for (const rel of game.state.relations) rel.contact = false;
    for (const unit of game.state.units) {
      unit.x = unit.factionId === 'helm' ? 2 : 57;
      unit.y = unit.factionId === 'helm' ? 2 : 37;
    }
    for (const city of game.state.cities) {
      city.x = city.factionId === 'helm' ? 2 : 57;
      city.y = city.factionId === 'helm' ? 2 : 37;
    }
    const foe = game.unitsOf('verdantia')[0];
    game.state.explored.helm[foe.y * game.state.width + foe.x] = true;
    expect(game.fogState('helm', foe.x, foe.y)).toBe(1);
    expect(game.inContact('helm', 'verdantia')).toBe(false);
  });

  it('does not let the AI propose or declare war on a faction it has not seen', () => {
    const game = Game.newGame({ seed: 8, player: 'helm', difficulty: 'brutal' });
    game.state.round = 200;
    const corners: Record<string, { x: number; y: number }> = {
      helm: { x: 2, y: 2 },
      verdantia: { x: 2, y: 37 },
      genesis: { x: 57, y: 2 },
      ironclad: { x: 57, y: 37 },
      mnemosyne: { x: 30, y: 2 },
      clio: { x: 30, y: 37 },
    };
    for (const unit of game.state.units) {
      const spot = corners[unit.factionId];
      unit.x = spot.x;
      unit.y = spot.y;
      unit.movesLeft = 0;
    }
    for (const rel of game.state.relations) rel.contact = false;
    game.state.whoseTurn = 'ironclad';
    game.state.factions.ironclad.isHuman = false;

    const quiet = game.state.log.length;
    runAi(game);
    const unseen = game.state.log.slice(quiet).map((line) => line.text);
    expect(unseen.some((text) => /declares war|offers/.test(text))).toBe(false);

    for (const rel of game.state.relations) rel.contact = true;
    const loud = game.state.log.length;
    runAi(game);
    const seen = game.state.log.slice(loud).map((line) => line.text);
    expect(seen.some((text) => text.includes('declares war'))).toBe(true);
  });
});
