import { mkdtempSync, readFileSync } from 'node:fs';
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
    expect(list.map((entry) => entry.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(list[0].empty).toBe(false);
    expect(list[1].empty).toBe(true);
    expect(list[3].empty).toBe(false);
    const loaded = await store.read(0);
    expect(loaded?.turn).toBe(1);
    const restored = Game.fromState(loaded!.state as never);
    expect(restored.citiesOf('verdantia')).toHaveLength(1);
    expect(readFileSync(join(dir, 'autosave.json'), 'utf8')).toContain('Verdantia');
    expect(readFileSync(join(dir, 'slot-3.json'), 'utf8')).toContain('manual');
  });
});
