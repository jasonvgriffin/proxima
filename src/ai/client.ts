import { computeRoundOrders, type RoundOrders } from './orders';
import type { FactionId, GameState } from '../core/types';

interface WorkerReply {
  id: number;
  orders?: RoundOrders;
  error?: string;
}

/** Which path served the latest rival round. Tests check that the browser used the worker. */
export let lastRivalPath: 'worker' | 'direct' = 'direct';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (orders: RoundOrders) => void; reject: (error: Error) => void }>();

function failPending(error: Error) {
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
}

function dropWorker() {
  worker?.terminate();
  worker = null;
}

async function workerInstance(): Promise<Worker> {
  if (worker) return worker;
  const mod = await import('./ai.worker?worker&inline');
  const created = new mod.default();
  created.onmessage = (event: MessageEvent<WorkerReply>) => {
    const waiter = pending.get(event.data.id);
    if (!waiter) return;
    pending.delete(event.data.id);
    if (event.data.orders) waiter.resolve(event.data.orders);
    else waiter.reject(new Error(event.data.error || 'AI worker returned no orders'));
  };
  created.onerror = (event) => {
    failPending(new Error(event.message || 'AI worker failed'));
    dropWorker();
  };
  worker = created;
  return created;
}

async function askWorker(state: GameState, order: readonly FactionId[]): Promise<RoundOrders> {
  const client = await workerInstance();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    client.postMessage({ id, state, order: [...order] });
  });
}

function sameBoard(before: GameState, orders: RoundOrders): boolean {
  return orders.state.seed === before.seed
    && orders.state.round === before.round
    && orders.state.width === before.width
    && orders.state.height === before.height
    && orders.state.playerTurnsCompleted === before.playerTurnsCompleted;
}

/**
 * Rival orders for one week. Uses a Web Worker in the browser and the direct
 * path where Worker is missing (Node tests and sims).
 */
export async function requestRoundOrders(state: GameState, order: readonly FactionId[]): Promise<RoundOrders> {
  const direct = () => {
    lastRivalPath = 'direct';
    return computeRoundOrders(state, order);
  };
  if (typeof Worker === 'undefined') return direct();
  try {
    const orders = await askWorker(state, order);
    if (!sameBoard(state, orders)) return direct();
    lastRivalPath = 'worker';
    return orders;
  } catch {
    return direct();
  }
}
