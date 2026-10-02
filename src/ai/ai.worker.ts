import { computeRoundOrders, type RoundOrders } from './orders';
import type { FactionId, GameState } from '../core/types';

interface WorkerRequest {
  id: number;
  state: GameState;
  order: FactionId[];
}

interface WorkerReply {
  id: number;
  orders?: RoundOrders;
  error?: string;
}

interface AiWorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply): void;
}

const scope = self as unknown as AiWorkerScope;

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, state, order } = event.data;
  try {
    const orders = computeRoundOrders(state, order);
    const reply: WorkerReply = { id, orders };
    scope.postMessage(reply);
  } catch (error) {
    const reply: WorkerReply = { id, error: error instanceof Error ? error.message : 'AI failed' };
    scope.postMessage(reply);
  }
};
