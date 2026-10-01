import type { SaveEnvelope } from '../core/types';

export interface SaveSummary {
  slot: number;
  empty: boolean;
  corrupt?: boolean;
  label?: string;
  savedAt?: string;
  year?: number;
  week?: number;
  faction?: string;
  turn?: number;
}

export interface SaveStore {
  list(): Promise<SaveSummary[]>;
  read(slot: number): Promise<SaveEnvelope | null>;
  write(slot: number, data: SaveEnvelope): Promise<void>;
}

const memory = new Map<number, SaveEnvelope>();

function summarize(slot: number, data: SaveEnvelope | undefined): SaveSummary {
  if (!data) return { slot, empty: true };
  return {
    slot,
    empty: false,
    label: data.label,
    savedAt: data.savedAt,
    year: data.year,
    week: data.week,
    faction: data.faction,
    turn: data.turn,
  };
}

export function createMemorySaveStore(): SaveStore {
  return {
    async list() {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => summarize(slot, memory.get(slot)));
    },
    async read(slot) {
      return memory.get(slot) ?? null;
    },
    async write(slot, data) {
      memory.set(slot, JSON.parse(JSON.stringify(data)) as SaveEnvelope);
    },
  };
}

export function createSaveStore(): SaveStore {
  if (typeof window !== 'undefined' && window.proxima?.isDesktop) {
    const bridge = window.proxima;
    return {
      list: () => bridge.listSaves(),
      async read(slot) {
        return (await bridge.readSave(slot)) as SaveEnvelope | null;
      },
      write: (slot, data) => bridge.writeSave(slot, data),
    };
  }
  return createMemorySaveStore();
}
