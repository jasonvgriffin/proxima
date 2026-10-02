import type { App } from '../app';
import { FACTIONS } from '../../core/factions';
import { Game } from '../../core/game';
import { type SaveEnvelope } from '../../core/types';
import { isAutosaveSlot, loadEntryLabel, newestAutosave, orderedLoadEntries } from '../../platform/autosave';
import { migrateSave, SAVE_VERSION } from '../../platform/saveMigrate';
import { esc } from '../text';

export async function openSave(this: App, purpose: string) {
  try {
    const list = await this.saves.list();
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="save-list">
        <h2>Save game</h2>
        <p class="muted">Nine manual slots. Three autosaves rotate on their own and are listed first when you load.</p>
        <div class="stack">
          ${list.filter((slot) => !isAutosaveSlot(slot.slot)).map((slot) => `<button class="btn" data-action="save-slot" data-testid="save-slot-${slot.slot}" data-slot="${slot.slot}" data-purpose="${purpose}">Slot ${slot.slot}${slot.empty ? ' · empty' : ` · ${esc(slot.label ?? '')}`}${slot.corrupt ? ' · unreadable' : ''}</button>`).join('')}
        </div>
        <button class="btn" data-action="close">Cancel</button>
      </div></div>`;
  } catch (error) {
    this.showSaveError(purpose === 'then-exit' ? 'Could not open the save list, so Proxima stayed open.' : 'Could not open the save list.', error);
  }
}

export async function openLoad(this: App, _fromGame: boolean) {
  try {
    const list = await this.saves.list();
    const newest = newestAutosave(list);
    const rows = orderedLoadEntries(list);
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="load-screen">
        <h2>Load game</h2>
        <div class="stack" data-testid="load-list">
          <button class="btn primary" data-action="continue" data-testid="load-continue" ${newest ? '' : 'disabled'}>Continue</button>
          ${rows.map((slot) => `<button class="btn" data-action="load-slot" data-testid="load-slot-${slot.slot}" data-slot="${slot.slot}" ${slot.empty && !slot.corrupt ? 'disabled' : ''}>${esc(loadEntryLabel(slot))}</button>`).join('')}
        </div>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
  } catch (error) {
    this.showSaveError('Could not open the save list.', error);
  }
}

export async function writeSlot(this: App, slot: number, purpose: string) {
  if (!this.game) return;
  try {
    const envelope = this.envelope(slot);
    await this.saves.write(slot, envelope);
    this.audio.play('save');
    this.toast(isAutosaveSlot(slot) ? 'Autosaved.' : `Saved to slot ${slot}.`);
    if (purpose === 'then-new' || purpose === 'then-exit') await this.finishPending(true);
    else if (purpose === 'manual') this.openPause();
  } catch (error) {
    const message = purpose === 'then-exit'
      ? 'Could not save the game, so Proxima stayed open.'
      : purpose === 'then-new'
        ? 'Could not save the game, so the new game was not started.'
        : purpose === 'autosave'
          ? 'Autosave failed. Your game is still running.'
          : `Could not save to slot ${slot}.`;
    this.showSaveError(message, error);
  }
}

export async function readSlot(this: App, slot: number) {
  try {
    const data = await this.saves.read(slot);
    if (!data) {
      this.showSaveError('That save is missing.');
      return;
    }
    const migrated = migrateSave(data);
    this.game = Game.fromState(migrated.state);
    this.selectedUnit = null;
    this.selectedCity = null;
    this.overlay.innerHTML = '';
    this.screen = 'game';
    this.gameMounted = false;
    this.render();
    this.toast(`Loaded ${migrated.label}.`);
  } catch (error) {
    this.showSaveError('Could not load that save.', error);
  }
}

export async function finishPending(this: App, saved: boolean) {
  const mode = this.pending?.mode;
  this.pending = null;
  this.overlay.innerHTML = '';
  if (mode === 'new') {
    this.screen = 'setup';
    this.game = null;
    this.render();
  } else if (mode === 'exit') await this.exitDesktop();
  void saved;
}

export async function exitDesktop(this: App) {
  if (this.updateReady) {
    await this.restartToApplyUpdate();
    return;
  }
  if (window.proxima?.quit) await window.proxima.quit();
  else {
    this.screen = 'menu';
    this.game = null;
    this.render();
    window.close();
  }
}

export function envelope(this: App, slot: number): SaveEnvelope {
  const game = this.game!;
  const cal = game.calendar();
  const faction = FACTIONS[game.state.playerFaction];
  return {
    version: SAVE_VERSION,
    gameVersion: 1,
    slot,
    savedAt: new Date().toISOString(),
    label: `${faction.name} — ${cal.label}`,
    turn: game.state.round,
    year: cal.year,
    week: cal.week,
    faction: faction.name,
    factionId: game.state.playerFaction,
    state: game.serialize(),
  };
}

export async function writeAutosave(this: App) {
  const slot = await this.saves.nextAutosaveSlot();
  await this.writeSlot(slot, 'autosave');
}

export async function continueAutosave(this: App) {
  const list = await this.saves.list();
  const newest = newestAutosave(list);
  if (!newest) {
    this.showSaveError('There is no autosave yet.');
    return;
  }
  await this.readSlot(newest.slot);
}

export async function runSave(this: App, work: () => Promise<void>, fallback: string) {
  try {
    await work();
  } catch (error) {
    this.showSaveError(fallback, error);
  }
}

export function showSaveError(this: App, message: string, error?: unknown) {
  const detail = error instanceof Error ? error.message : '';
  const text = detail && !message.includes(detail) ? `${message} ${detail}` : message;
  void this.platform.reportError(error instanceof Error && error.stack ? `${text}\n${error.stack}` : text);
  this.overlay.innerHTML = `
    <div class="modal-back" data-testid="save-error">
      <div class="modal narrow">
        <h2>Save problem</h2>
        <p data-testid="save-error-message">${esc(text)}</p>
        <button class="btn" data-action="close" data-testid="save-error-ok">OK</button>
      </div>
    </div>`;
}

