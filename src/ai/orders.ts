import { Game } from '../core/game';
import type { FactionId, GameState } from '../core/types';

/** What a rival round decided. The main thread adopts `state` and then closes the week. */
export interface RoundOrders {
  order: FactionId[];
  state: GameState;
}

/**
 * In-thread rival round. The worker returns this, and Node tests call it directly
 * so sims do not need a browser Worker.
 */
export function computeRoundOrders(state: GameState, order: readonly FactionId[]): RoundOrders {
  const game = new Game(structuredClone(state));
  game.playRivals(order);
  return { order: [...order], state: game.snapshot() };
}
