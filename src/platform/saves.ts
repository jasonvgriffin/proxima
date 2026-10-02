import type { SaveEnvelope } from '../core/types';
import { AUTOSAVE_SLOTS, MANUAL_SLOTS } from './autosave';

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
  /** Which autosave file to write next. Must not read save bodies. */
  nextAutosaveSlot(): Promise<number>;
}

const memory = new Map<number, SaveEnvelope>();
const SAVE_SLOTS = [...AUTOSAVE_SLOTS, ...MANUAL_SLOTS];

function initialMemoryCursor(): number {
  const emptyAt = AUTOSAVE_SLOTS.findIndex((slot) => !memory.has(slot));
  if (emptyAt !== -1) return emptyAt;
  let oldest = 0;
  for (let i = 1; i < AUTOSAVE_SLOTS.length; i += 1) {
    const left = memory.get(AUTOSAVE_SLOTS[i])?.savedAt ?? '';
    const right = memory.get(AUTOSAVE_SLOTS[oldest])?.savedAt ?? '';
    if (left < right) oldest = i;
  }
  return oldest;
}

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
  let autosaveCursor: number | null = null;
  return {
    async list() {
      return SAVE_SLOTS.map((slot) => summarize(slot, memory.get(slot)));
    },
    async read(slot) {
      return memory.get(slot) ?? null;
    },
    async write(slot, data) {
      memory.set(slot, JSON.parse(JSON.stringify(data)) as SaveEnvelope);
      const index = (AUTOSAVE_SLOTS as readonly number[]).indexOf(slot);
      if (index >= 0) autosaveCursor = (index + 1) % AUTOSAVE_SLOTS.length;
    },
    async nextAutosaveSlot() {
      if (autosaveCursor == null) autosaveCursor = initialMemoryCursor();
      return AUTOSAVE_SLOTS[autosaveCursor];
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
      nextAutosaveSlot: () => bridge.nextAutosaveSlot(),
    };
  }
  return createMemorySaveStore();
}
