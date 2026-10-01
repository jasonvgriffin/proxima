import { describe, expect, it } from 'vitest';
import { chooseDesign, chooseResearchTarget, runAi } from '../src/core/ai';
import { FACTIONS } from '../src/core/factions';
import { Game } from '../src/core/game';
import { pathToGoal } from '../src/core/researchPath';
import { startingTechs } from '../src/core/tech';

describe('AI research on the tech graph', () => {
  it('walks a specialty faction toward its late branch, prerequisites included', () => {
    const ironclad = chooseResearchTarget('ironclad', startingTechs('ironclad'), FACTIONS.ironclad.personality);
    expect(ironclad).toEqual({ id: 'planetary-supremacy', asGoal: true });
    const verdantia = chooseResearchTarget('verdantia', startingTechs('verdantia'), FACTIONS.verdantia.personality);
    expect(verdantia).toEqual({ id: 'world-garden', asGoal: true });
    expect(pathToGoal('world-garden', startingTechs('verdantia'))).toContain('sealed-habitats');
  });

  it('starts a general faction on a technology it can study immediately', () => {
    const helm = chooseResearchTarget('helm', startingTechs('helm'), FACTIONS.helm.personality);
    expect(helm).toEqual({ id: 'salvage-rigs', asGoal: false });
  });

  it('queues the conquest path when Ironclad takes a turn', () => {
    const game = Game.newGame({ seed: 3, player: 'helm' });
    game.state.whoseTurn = 'ironclad';
    game.state.factions.ironclad.isHuman = false;
    runAi(game);
    const faction = game.state.factions.ironclad;
    expect(faction.researchGoal).toBe('planetary-supremacy');
    expect(faction.researching).toBeTruthy();
    expect(faction.researchQueue[0]).toBe(faction.researching);
    expect(faction.researchQueue.at(-1)).toBe('planetary-supremacy');
  });

  it('fields infantry that use a weapon the tech tree has unlocked', () => {
    const game = Game.newGame({ seed: 3, player: 'helm' });
    game.state.whoseTurn = 'ironclad';
    game.state.factions.ironclad.techs.push('coil-weapons');
    chooseDesign(game, 'ironclad');
    const coil = game.state.factions.ironclad.customDesigns.find((design) => design.weapon === 'coil');
    expect(coil?.name).toBe('Coil Infantry');
    expect(coil?.role).toBe('military');
  });
});
