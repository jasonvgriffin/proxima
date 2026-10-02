import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';

const require = createRequire(import.meta.url);
const { createFileSaveStore } = require('../shared/saveStore.cjs') as {
  createFileSaveStore: (dir: string) => {
    list: () => Promise<{ slot: number; empty: boolean }[]>;
    read: (slot: number) => Promise<{ state: unknown; turn: number } | null>;
    write: (slot: number, data: unknown) => Promise<void>;
    nextAutosaveSlot: () => Promise<number>;
    directory: string;
  };
};

describe('file saves', () => {
  it('writes the autosave first and nine manual slots as files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    const store = createFileSaveStore(dir);
    const game = Game.newGame({ seed: 4, player: 'verdantia' });
    const settler = game.unitsOf('verdantia').find((unit) => unit.canFound)!;
    game.foundCity(settler.id);
    const payload = {
      version: 1,
      slot: 0,
      savedAt: '2460-01-01',
      label: 'Verdantia — Year 2460, Week 1',
      turn: game.state.round,
      year: 2460,
      week: 1,
      faction: 'Verdantia',
      factionId: 'verdantia',
      state: game.serialize(),
    };
    await store.write(0, payload);
    await store.write(3, { ...payload, slot: 3, label: 'manual' });
    const list = await store.list();
    expect(list.map((entry) => entry.slot)).toEqual([0, 10, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(list.find((entry) => entry.slot === 0)?.empty).toBe(false);
    expect(list.find((entry) => entry.slot === 1)?.empty).toBe(true);
    expect(list.find((entry) => entry.slot === 3)?.empty).toBe(false);
    const loaded = await store.read(0);
    expect(loaded?.turn).toBe(1);
    const restored = Game.fromState(loaded!.state as never);
    expect(restored.citiesOf('verdantia')).toHaveLength(1);
    expect(readFileSync(join(dir, 'autosave.json'), 'utf8')).toContain('Verdantia');
    expect(readFileSync(join(dir, 'slot-3.json'), 'utf8')).toContain('manual');
  });

  it('keeps a .bak of the previous file before overwriting a slot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    const store = createFileSaveStore(dir);
    await store.write(1, { version: 1, label: 'first' });
    await store.write(1, { version: 1, label: 'second' });
    expect(readFileSync(join(dir, 'slot-1.json'), 'utf8')).toContain('second');
    expect(readFileSync(join(dir, 'slot-1.json.bak'), 'utf8')).toContain('first');
  });

  it('rotates three autosave files and leaves the legacy autosave in place until the others exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    const store = createFileSaveStore(dir);
    const payload = { version: 1, label: 'turn', savedAt: '2026-01-01T00:00:00.000Z', turn: 3 };
    expect(await store.nextAutosaveSlot()).toBe(0);
    expect(await store.nextAutosaveSlot()).toBe(0);
    await store.write(0, payload);
    expect(await store.nextAutosaveSlot()).toBe(10);
    await store.write(10, { ...payload, turn: 6, savedAt: '2026-01-02T00:00:00.000Z' });
    expect(await store.nextAutosaveSlot()).toBe(11);
    await store.write(11, { ...payload, turn: 9, savedAt: '2026-01-03T00:00:00.000Z' });
    expect(readFileSync(join(dir, 'autosave.json'), 'utf8')).toContain('"turn":3');
    expect(readFileSync(join(dir, 'autosave-2.json'), 'utf8')).toContain('"turn":6');
    expect(readFileSync(join(dir, 'autosave-3.json'), 'utf8')).toContain('"turn":9');
    expect(await store.nextAutosaveSlot()).toBe(0);

    const legacy = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    writeFileSync(join(legacy, 'autosave.json'), JSON.stringify({ ...payload, label: 'legacy' }));
    const upgraded = createFileSaveStore(legacy);
    expect(await upgraded.nextAutosaveSlot()).toBe(10);
    expect(readFileSync(join(legacy, 'autosave.json'), 'utf8')).toContain('legacy');

    const now = Date.now();
    utimesSync(join(dir, 'autosave.json'), now / 1000, (now - 30_000) / 1000);
    utimesSync(join(dir, 'autosave-2.json'), now / 1000, (now - 20_000) / 1000);
    utimesSync(join(dir, 'autosave-3.json'), now / 1000, (now - 10_000) / 1000);
    const restarted = createFileSaveStore(dir);
    expect(await restarted.nextAutosaveSlot()).toBe(0);
  });

  it('picks the next autosave without reading save bodies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    writeFileSync(join(dir, 'autosave.json'), JSON.stringify({ label: 'kept', turn: 3 }));
    writeFileSync(join(dir, 'slot-1.json'), 'x'.repeat(50_000));
    const store = createFileSaveStore(dir);
    const fs = require('node:fs') as typeof import('node:fs');
    const original = fs.readFileSync;
    let reads = 0;
    fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
      reads += 1;
      return original.apply(fs, args);
    }) as typeof fs.readFileSync;
    try {
      expect(await store.nextAutosaveSlot()).toBe(10);
      expect(reads).toBe(0);
    } finally {
      fs.readFileSync = original;
    }
  });

  it('does not crash on a corrupt file or a missing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'proxima-saves-'));
    const store = createFileSaveStore(dir);
    writeFileSync(join(dir, 'slot-2.json'), '{not json');
    const read = store.read(2);
    await expect(read).rejects.toThrow(/unreadable \(slot-2\.json\)/);
    expect(await store.read(4)).toBeNull();
    const list = await store.list();
    expect(list.find((entry) => entry.slot === 2)).toMatchObject({ slot: 2, corrupt: true });
    expect(list.find((entry) => entry.slot === 4)).toMatchObject({ slot: 4, empty: true });
  });
});
