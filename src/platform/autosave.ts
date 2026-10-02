import type { SaveSummary } from './saves';

/**
 * Slot 0 stays `autosave.json` so an in-place upgrade still finds the old file.
 * Slots 10 and 11 are the other two rotating autosaves. Manual saves stay 1–9.
 */
export const AUTOSAVE_SLOTS = [0, 10, 11] as const;
export const MANUAL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function isAutosaveSlot(slot: number): boolean {
  return (AUTOSAVE_SLOTS as readonly number[]).includes(slot);
}

/** Local clock time, stable enough to test by rebuilding the same Date. */
export function formatSaveTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function loadEntryLabel(entry: Pick<SaveSummary, 'slot' | 'empty' | 'corrupt' | 'label' | 'savedAt' | 'turn'>): string {
  const name = isAutosaveSlot(entry.slot) ? 'Autosave' : `Slot ${entry.slot}`;
  if (entry.corrupt) return `${name} · unreadable`;
  if (entry.empty) return `${name} · empty`;
  if (!isAutosaveSlot(entry.slot)) return `${name} · ${entry.label ?? ''}`;
  const turn = entry.turn != null ? `Turn ${entry.turn}` : '';
  const time = entry.savedAt ? formatSaveTime(entry.savedAt) : '';
  const bits = [name, turn, time, entry.label ?? ''].filter((part) => part.length > 0);
  return bits.join(' · ');
}

/** Newest autosave first, then empty or unreadable autosaves, then manual slots 1–9. */
export function orderedLoadEntries(list: readonly SaveSummary[]): SaveSummary[] {
  const bySlot = new Map(list.map((entry) => [entry.slot, entry]));
  const autos = AUTOSAVE_SLOTS.map((slot) => bySlot.get(slot)).filter((entry): entry is SaveSummary => !!entry);
  const filled = autos.filter((entry) => !entry.empty && !entry.corrupt);
  const rest = autos.filter((entry) => entry.empty || entry.corrupt);
  filled.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? '') || (b.turn ?? 0) - (a.turn ?? 0));
  const manuals = MANUAL_SLOTS.map((slot) => bySlot.get(slot)).filter((entry): entry is SaveSummary => !!entry);
  return [...filled, ...rest, ...manuals];
}

/** The autosave Continue loads. Manual slots are ignored even if they are newer. */
export function newestAutosave(list: readonly SaveSummary[]): SaveSummary | null {
  const filled = list.filter((entry) => isAutosaveSlot(entry.slot) && !entry.empty && !entry.corrupt);
  filled.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? '') || (b.turn ?? 0) - (a.turn ?? 0));
  return filled[0] ?? null;
}
