import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { appendHistory, HISTORY_CAP } from '../src/core/tilelog';
import type { GameState, TerraformEntry } from '../src/core/types';

function game() {
  return Game.newGame({
    seed: 4,
    player: 'helm',
    difficulty: 'easy',
    alliedVictory: false,
    randomEvents: false,
  });
}

describe('tile terraform history', () => {
  it('records who finished a project, a replacement, and work still in progress', () => {
    const match = game();
    const former = match.unitsOf('helm').find((unit) => unit.canTerraform)!;
    const tile = match.tile(former.x, former.y);
    expect(match.startTerraform(former.id, 'farm').ok).toBe(true);
    const working = match.tileView(former.x, former.y);
    expect(working.kind).toBe('live');
    expect(working.sight?.working?.project).toBe('farm');
    expect(working.sight?.working?.turnsLeft).toBeGreaterThan(0);

    match.advanceTerraform(former.id);
    expect(tile.improvement).toBe('farm');
    expect(tile.history.some((entry) => entry.factionId === 'helm' && entry.unitName === former.name && entry.change.includes('farm'))).toBe(true);
    const shown = match.tileView(former.x, former.y);
    expect(shown.lines).toContain('Farm');

    expect(match.startTerraform(former.id, 'mine').ok).toBe(true);
    match.advanceTerraform(former.id);
    expect(tile.history.some((entry) => entry.change.includes('replaced') && entry.change.includes('mine'))).toBe(true);
  });

  it('logs sabotage and a seismic shift', () => {
    const match = game();
    const rival = 'verdantia' as const;
    const settler = match.unitsOf(rival).find((unit) => unit.canFound)!;
    match.state.whoseTurn = rival;
    match.state.factions[rival].credits += 200;
    match.state.factions[rival].energy += 10;
    expect(match.foundCity(settler.id).ok).toBe(true);
    const former = match.unitsOf(rival).find((unit) => unit.canTerraform)!;
    expect(match.startTerraform(former.id, 'solar').ok).toBe(true);
    match.advanceTerraform(former.id);
    match.state.whoseTurn = 'helm';
    match.state.factions.helm.credits += 400;
    expect(match.recruitSpy().ok).toBe(true);
    const spy = match.state.spies.find((entry) => entry.owner === 'helm')!;
    expect(match.placeSpy(spy.id, rival).ok).toBe(true);
    expect(match.resolveSabotage(spy.id, 0.99).ok).toBe(true);
    const ruined = match.tile(former.x, former.y);
    expect(ruined.improvement).toBeNull();
    expect(ruined.history.some((entry) => entry.change.includes('removed') && entry.factionId === 'helm')).toBe(true);

    const pod = match.unitsOf('helm').find((unit) => unit.canFound)!;
    expect(match.foundCity(pod.id).ok).toBe(true);
    match.state.events.prompt = {
      id: 1,
      kind: 'seismic',
      text: 'The ground shifts.',
      choices: [{ id: 'brace', label: 'Brace' }],
    };
    expect(match.chooseEvent('brace').ok).toBe(true);
    expect(match.state.tiles.some((tile) => tile.history.some((entry) => entry.change.includes('seismic')))).toBe(true);
  });

  it('folds old history and migrates a save that has none', () => {
    let history: TerraformEntry[] = [];
    for (let i = 0; i < 12; i++) {
      history = appendHistory(history, { round: i + 1, factionId: 'helm', unitName: 'Former', change: `step ${i}` });
    }
    expect(history.length).toBe(HISTORY_CAP);
    expect(history[0].change).toMatch(/folded/);
    expect(history[history.length - 1].change).toBe('step 11');

    const match = game();
    const raw = match.serialize();
    for (const tile of raw.tiles) delete (tile as { history?: TerraformEntry[] }).history;
    delete (raw as { sight?: GameState['sight'] }).sight;
    const loaded = Game.fromState(raw);
    expect(loaded.state.tiles.every((tile) => Array.isArray(tile.history) && tile.history.length === 0)).toBe(true);
    expect(Object.values(loaded.state.sight).every((sight) => sight.history.length === 0)).toBe(true);
  });

  it('hides unexplored tiles and keeps a stale last look once vision moves on', () => {
    const match = game();
    const former = match.unitsOf('helm').find((unit) => unit.canTerraform)!;
    expect(match.startTerraform(former.id, 'farm').ok).toBe(true);
    match.advanceTerraform(former.id);
    match.noteSight();
    const x = former.x;
    const y = former.y;
    for (const unit of match.unitsOf('helm')) {
      unit.x = 0;
      unit.y = 0;
    }
    match.tile(x, y).improvement = 'mine';
    const stale = match.tileView(x, y);
    expect(stale.kind).toBe('stale');
    expect(stale.sight?.improvement).toBe('farm');

    const hidden = match.state.tiles.find((tile) => !match.playerSees(tile.x, tile.y));
    expect(hidden).toBeTruthy();
    expect(match.tileView(hidden!.x, hidden!.y).kind).toBe('hidden');
  });
});
