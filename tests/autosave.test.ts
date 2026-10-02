import { describe, expect, it } from 'vitest';
import { AUTOSAVE_SLOTS, MANUAL_SLOTS } from '../src/platform/autosave';
import { formatSaveTime, loadEntryLabel, newestAutosave, orderedLoadEntries } from '../src/platform/autosave';
import type { SaveSummary } from '../src/platform/saves';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const store = require('../shared/saveStore.cjs') as {
  AUTOSAVE_SLOTS: number[];
  MANUAL_SLOTS: number[];
};

function entry(partial: Partial<SaveSummary> & { slot: number }): SaveSummary {
  return { empty: false, ...partial };
}

describe('autosave slots', () => {
  it('uses the same slot numbers in the desktop store and the renderer', () => {
    expect(store.AUTOSAVE_SLOTS).toEqual([...AUTOSAVE_SLOTS]);
    expect(store.MANUAL_SLOTS).toEqual([...MANUAL_SLOTS]);
  });

  it('shows turn and local time on autosaves, and keeps manual slot text', () => {
    const savedAt = new Date(2026, 9, 1, 15, 4, 0).toISOString();
    expect(formatSaveTime(savedAt)).toBe('2026-10-01 15:04');
    const label = loadEntryLabel({ slot: 10, empty: false, turn: 6, savedAt, label: 'The Helm — Year 2460, Week 4' });
    expect(label).toContain('Autosave');
    expect(label).toContain('Turn 6');
    expect(label).toContain('2026-10-01 15:04');
    expect(label).toContain('The Helm — Year 2460, Week 4');
    expect(loadEntryLabel({ slot: 1, empty: false, label: 'manual', turn: 2, savedAt })).toBe('Slot 1 · manual');
    expect(loadEntryLabel({ slot: 0, empty: true })).toBe('Autosave · empty');
  });

  it('loads the newest autosave for Continue and lists it first', () => {
    const list = [
      entry({ slot: 0, savedAt: '2026-01-01T00:00:00.000Z', turn: 3, label: 'first' }),
      entry({ slot: 10, savedAt: '2026-01-03T00:00:00.000Z', turn: 9, label: 'third' }),
      entry({ slot: 11, savedAt: '2026-01-02T00:00:00.000Z', turn: 6, label: 'second' }),
      entry({ slot: 1, savedAt: '2026-02-01T00:00:00.000Z', turn: 40, label: 'manual' }),
      entry({ slot: 2, empty: true }),
    ];
    expect(newestAutosave(list)?.slot).toBe(10);
    expect(newestAutosave(list)?.turn).toBe(9);
    const ordered = orderedLoadEntries(list);
    expect(ordered.map((row) => row.slot)).toEqual([10, 11, 0, 1, 2]);
    expect(newestAutosave([entry({ slot: 1, savedAt: '2026-02-01T00:00:00.000Z', turn: 4 })])).toBeNull();
  });
});
