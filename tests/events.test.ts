import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { EVENT_KINDS, eventPopupAction, eventPromptFor } from '../src/core/events';
import { Game } from '../src/core/game';

function readyGame() {
  const game = Game.newGame({ seed: 4, player: 'helm', randomEvents: true });
  const pod = game.unitsOf('helm').find((unit) => unit.canFound)!;
  game.state.factions.helm.credits += 80;
  game.state.factions.helm.energy = 40;
  game.state.factions.helm.minerals = 40;
  expect(game.foundCity(pod.id).ok).toBe(true);
  game.relation('helm', 'verdantia').stance = 'nap';
  game.relation('helm', 'verdantia').contact = true;
  return game;
}

describe('random event choices', () => {
  it('closes a resolved popup and leaves a prompt the player cannot pay for', () => {
    const waiting = eventPromptFor('seismic', 1);
    expect(eventPopupAction(waiting, true)).toBe('leave');
    expect(eventPopupAction(waiting, false)).toBe('open');
    expect(eventPopupAction(null, true)).toBe('close');
    expect(eventPopupAction(null, false)).toBe('leave');

    const broke = readyGame();
    broke.state.factions.helm.minerals = 0;
    broke.state.events.prompt = eventPromptFor('seismic', 2);
    const shore = broke.chooseEvent('shore');
    expect(shore.ok).toBe(false);
    expect(shore.message).toMatch(/minerals/);
    expect(broke.state.events.prompt?.kind).toBe('seismic');
    expect(eventPopupAction(broke.state.events.prompt, true)).toBe('leave');
  });

  it('resolves every option, including brace, and then has nothing left to decide', () => {
    for (const kind of EVENT_KINDS) {
      const sample = eventPromptFor(kind, 1);
      for (const choice of sample.choices) {
        const game = readyGame();
        const prompt = eventPromptFor(kind, game.state.events.nextId++);
        if (kind === 'betrayal') prompt.subject = 'verdantia';
        game.state.events.prompt = prompt;
        const answered = game.chooseEvent(choice.id);
        expect(answered.ok, `${kind} / ${choice.id} ${answered.message}`).toBe(true);
        expect(game.state.events.prompt, `${kind} / ${choice.id}`).toBeNull();
        expect(eventPopupAction(game.state.events.prompt, true)).toBe('close');
        const again = game.chooseEvent(choice.id);
        expect(again.ok, `${kind} / ${choice.id}`).toBe(false);
        expect(again.message).toBe('Nothing is asking for a decision.');
      }
    }
  });

  it('shakes a city when the player braces, and spends minerals when they shore the walls', () => {
    const braced = readyGame();
    const city = braced.citiesOf('helm')[0];
    const hp = city.defenseHp;
    braced.state.events.prompt = eventPromptFor('seismic', 3);
    expect(braced.chooseEvent('brace').ok).toBe(true);
    expect(city.defenseHp).toBeLessThan(hp);
    expect(braced.state.log.some((line) => /shaken|empty ground/.test(line.text))).toBe(true);
    expect(braced.state.events.prompt).toBeNull();

    const shored = readyGame();
    const before = shored.state.factions.helm.minerals;
    shored.state.events.prompt = eventPromptFor('seismic', 4);
    expect(shored.chooseEvent('shore').ok).toBe(true);
    expect(shored.state.factions.helm.minerals).toBe(before - CONFIG.events.seismicMinerals);
    expect(shored.state.events.prompt).toBeNull();
  });
});
