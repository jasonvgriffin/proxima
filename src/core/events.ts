import { CONFIG } from '../config';
import type { EventKind, EventPrompt, GameEvents } from './types';

export const EVENT_KINDS: readonly EventKind[] = [
  'solar-flare',
  'wreckage',
  'betrayal',
  'dust-storm',
  'seismic',
];

export function blankEvents(): GameEvents {
  return {
    nextId: 1,
    nextRollRound: CONFIG.events.minRound,
    pending: null,
    prompt: null,
    solarFlareUntil: 0,
    dustUntil: 0,
    dustShelter: false,
  };
}

export function eventWarningText(kind: EventKind): string {
  switch (kind) {
    case 'solar-flare':
      return 'Sensors stutter. A solar flare may hit the band within a few weeks.';
    case 'wreckage':
      return 'A patrol reports an intact piece of the ark, not yet reached.';
    case 'betrayal':
      return 'Rumors say an oath on Proxima is about to break.';
    case 'dust-storm':
      return 'The horizon browns. A dust storm is building.';
    case 'seismic':
      return 'The ground ticks. A seismic shift may open under a city.';
  }
}

export type EventPopupAction = 'open' | 'close' | 'leave';

/**
 * The event box stays only while a prompt is still waiting.
 * Choosing an option such as "Brace and keep working" clears the prompt in the
 * game. If the box is left on screen, the next click on either option finds
 * nothing to decide. A choice the player cannot pay for keeps the prompt, and
 * the box stays with it.
 */
export function eventPopupAction(prompt: EventPrompt | null, popupOpen: boolean): EventPopupAction {
  if (prompt && !popupOpen) return 'open';
  if (!prompt && popupOpen) return 'close';
  return 'leave';
}

export function eventPromptFor(kind: EventKind, id: number): EventPrompt {
  switch (kind) {
    case 'solar-flare':
      return {
        id,
        kind,
        text: 'A solar flare is breaking over the day side. Comms and sensors will fail unless you power the grid down.',
        choices: [
          { id: 'shield', label: 'Power down the sensors' },
          { id: 'ride', label: 'Keep broadcasting' },
        ],
      };
    case 'wreckage':
      return {
        id,
        kind,
        text: 'The patrol has reached an intact ark module. There is time to take one thing from it.',
        choices: [
          { id: 'supplies', label: 'Salvage the supplies' },
          { id: 'study', label: 'Study the wreck' },
          { id: 'crew', label: 'Recover a crew' },
        ],
      };
    case 'betrayal':
      return {
        id,
        kind,
        text: 'A partner has turned. You can answer the break in arms, or spend the moment suing for peace.',
        choices: [
          { id: 'strike', label: 'Accept the war' },
          { id: 'plead', label: 'Sue for peace' },
        ],
      };
    case 'dust-storm':
      return {
        id,
        kind,
        text: 'Dust is closing the band. Units can shelter in cities, or push through and take the wear.',
        choices: [
          { id: 'shelter', label: 'Shelter in the cities' },
          { id: 'push', label: 'Push through the dust' },
        ],
      };
    case 'seismic':
      return {
        id,
        kind,
        text: 'A fault is opening under one of your cities. Minerals can shore the walls. Otherwise the yards take the hit.',
        choices: [
          { id: 'shore', label: 'Shore up the walls' },
          { id: 'brace', label: 'Brace and keep working' },
        ],
      };
  }
}
