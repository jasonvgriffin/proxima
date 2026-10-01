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
  it('loads a 0.1.0 version 1 save as version 2', () => {
    const migrated = migrateSave(v1Envelope());
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.version).toBe(2);
    expect(migrated.gameVersion).toBe(1);
    expect(migrated.state.autosaveEnabled).toBe(true);
    expect(migrated.state.version).toBe(1);
    const restored = Game.fromState(migrated.state);
    expect(restored.state.playerFaction).toBe('helm');
    expect(restored.unitsOf('helm').length).toBeGreaterThan(0);
  });

  it('walks the chain and leaves a current save on version 2', () => {
    const once = migrateSave(v1Envelope());
    const twice = migrateSave(once);
    expect(twice.version).toBe(2);
    expect(twice.label).toBe(once.label);
    expect(twice.state.seed).toBe(once.state.seed);
  });

  it('rejects a save with no version, a newer version, or a broken file', () => {
    expect(() => migrateSave({ slot: 1, state: {} })).toThrow(/no version/);
    expect(() => migrateSave({ version: 9, slot: 1, label: 'x', factionId: 'helm', state: {} })).toThrow(/newer Proxima/);
    expect(() => migrateSave({ version: 1, slot: 1, label: 'Helm', factionId: 'helm' })).toThrow(/no game data/);
    expect(() => migrateSave('nope')).toThrow(/not a Proxima file/);
  });
});
