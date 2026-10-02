import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { SAVE_VERSION, migrateSave } from '../src/platform/saveMigrate';

function v1Envelope() {
  const game = Game.newGame({ seed: 9, player: 'helm' });
  const state = game.serialize();
  delete (state as { autosaveEnabled?: boolean }).autosaveEnabled;
  return {
    version: 1,
    slot: 2,
    savedAt: '2026-03-01T00:00:00.000Z',
    label: 'The Helm — Year 2460, Week 1',
    turn: state.round,
    year: 2460,
    week: 1,
    faction: 'The Helm',
    factionId: 'helm',
    state,
  };
}

describe('save migration', () => {
  it('loads a 0.1.0 version 1 save as the current schema', () => {
    const migrated = migrateSave(v1Envelope());
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.version).toBe(6);
    expect(migrated.state.mapSize).toBe('medium');
    expect(migrated.gameVersion).toBe(1);
    expect(migrated.state.autosaveEnabled).toBe(true);
    expect(migrated.state.version).toBe(1);
    const restored = Game.fromState(migrated.state);
    expect(restored.state.playerFaction).toBe('helm');
    expect(restored.unitsOf('helm').length).toBeGreaterThan(0);
  });

  it('gives a version 2 save empty tile history and drops the stripe on the way to the current schema', () => {
    const envelope = v1Envelope();
    envelope.version = 2;
    for (const tile of envelope.state.tiles) delete (tile as { history?: unknown }).history;
    delete (envelope.state as { sight?: unknown }).sight;
    const migrated = migrateSave(envelope);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.state.tiles.every((tile) => Array.isArray(tile.history) && tile.history.length === 0)).toBe(true);
    expect(migrated.state.sight).toEqual({});
    const restored = Game.fromState(migrated.state);
    expect(restored.state.tiles.every((tile) => tile.history.length === 0)).toBe(true);
  });

  it('keeps terraform history when a version 3 save drops the climate stripe', () => {
    const envelope = v1Envelope();
    envelope.version = 3;
    const sample = envelope.state.tiles[0] as { zone?: string; livable?: boolean; history?: unknown };
    sample.zone = 'day';
    sample.livable = false;
    sample.history = [{ round: 4, factionId: 'helm', unitName: 'Former', change: 'built a farm' }];
    const migrated = migrateSave(envelope);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(sample.zone).toBe('day');
    const kept = migrated.state.tiles[0];
    expect(kept).not.toHaveProperty('zone');
    expect(kept).not.toHaveProperty('livable');
    expect(kept.history[0]?.change).toContain('farm');
  });

  it('walks the chain and leaves a current save on the current version', () => {
    const once = migrateSave(v1Envelope());
    const twice = migrateSave(once);
    expect(twice.version).toBe(SAVE_VERSION);
    expect(twice.label).toBe(once.label);
    expect(twice.state.seed).toBe(once.state.seed);
  });

  it('treats an old deal as contact and leaves a blank peace untouched', () => {
    for (const start of [3, 4]) {
      const envelope = v1Envelope();
      envelope.version = start;
      for (const rel of envelope.state.relations) delete (rel as { contact?: boolean }).contact;
      const war = envelope.state.relations[0];
      war.stance = 'war';
      const migrated = migrateSave(envelope);
      expect(migrated.version).toBe(6);
      expect(migrated.state.mapSize).toBe('medium');
      expect(migrated.state.relations[0].contact).toBe(true);
      expect(migrated.state.relations.slice(1).every((rel) => rel.contact === false)).toBe(true);
    }
  });

  it('keeps the current schema and accepts the extra autosave slot numbers', () => {
    const migrated = migrateSave(v1Envelope());
    expect(SAVE_VERSION).toBe(6);
    for (const slot of [0, 9, 10, 11]) {
      expect(migrateSave({ ...migrated, slot }).slot).toBe(slot);
    }
    expect(() => migrateSave({ ...migrated, slot: 12 })).toThrow(/slot/);
  });

  it('rejects a save with no version, a newer version, or a broken file', () => {
    expect(() => migrateSave({ slot: 1, state: {} })).toThrow(/no version/);
    expect(() => migrateSave({ version: 9, slot: 1, label: 'x', factionId: 'helm', state: {} })).toThrow(/newer Proxima/);
    expect(() => migrateSave({ version: 1, slot: 1, label: 'Helm', factionId: 'helm' })).toThrow(/no game data/);
    expect(() => migrateSave('nope')).toThrow(/not a Proxima file/);
  });

  it('drops stripe fields from a version 2 save and still loads the game', () => {
    const envelope = v1Envelope();
    envelope.version = 2;
    const sample = envelope.state.tiles[0] as { zone?: string; livable?: boolean; elevation?: number };
    sample.zone = 'twilight';
    sample.livable = true;
    delete sample.elevation;
    const migrated = migrateSave(envelope);
    expect(migrated.version).toBe(SAVE_VERSION);
    const tile = migrated.state.tiles[0] as {
      x: number;
      y: number;
      zone?: string;
      livable?: boolean;
      elevation: number;
      river: boolean;
      special: null;
    };
    expect(tile.zone).toBeUndefined();
    expect(tile.livable).toBeUndefined();
    expect(typeof tile.elevation).toBe('number');
    expect(tile.river).toBe(false);
    expect(tile.special).toBeNull();
    const restored = Game.fromState(migrated.state);
    expect(restored.tile(tile.x, tile.y).elevation).toBe(tile.elevation);
  });

  it('loads a save from before map sizes as medium and keeps a chosen size', () => {
    const old = v1Envelope();
    old.version = 5;
    delete (old.state as { mapSize?: string }).mapSize;
    const migrated = migrateSave(old);
    expect(migrated.version).toBe(6);
    expect(migrated.state.mapSize).toBe('medium');
    expect(migrated.state.width).toBe(60);
    expect(migrated.state.height).toBe(40);
    const restored = Game.fromState(migrated.state);
    expect(restored.state.mapSize).toBe('medium');

    const small = Game.newGame({ seed: 4, player: 'helm', mapSize: 'small' });
    const again = Game.fromState(small.serialize());
    expect(again.state.mapSize).toBe('small');
    expect(again.state.width).toBe(small.state.width);
    expect(again.state.height).toBe(small.state.height);
  });
});
