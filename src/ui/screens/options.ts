import type { App } from '../app';
import { APP_VERSION } from '../../version';
import { difficultyLabel, difficultyProfile } from '../../core/difficulty';
import { FACTIONS, PERSONALITY_LEVELS } from '../../core/factions';
import { autosaveIntervalTurns } from '../../core/rules';
import { FACTION_IDS } from '../../core/types';
import { esc } from '../text';
import { renderAudioSettings } from '../audioSettings';

export function renderOptions(this: App) {
  const traits = Object.keys(PERSONALITY_LEVELS) as (keyof typeof PERSONALITY_LEVELS)[];
  this.stage.innerHTML = `
    <div class="sheet options-screen" data-testid="options-screen">
      <button class="btn options-back" data-action="back-menu" data-testid="options-back">Back to start</button>
      <div class="sheet-card">
        <p class="eyebrow">Game options</p>
        <h2>Rival personalities</h2>
        <p class="muted">Difficulty on the start menu sets how soon rivals attack. A change here overrides that rival's own temperament.</p>
        <table class="grid">
          <tr><th>Faction</th>${traits.map((trait) => `<th>${esc(trait)}</th>`).join('')}</tr>
          ${FACTION_IDS.map((id) => `<tr><td>${esc(FACTIONS[id].name)}</td>${traits.map((trait) => `<td><select data-personality="${id}" data-trait="${trait}">${PERSONALITY_LEVELS[trait].map((level) => `<option value="${level.id}" ${this.setup.personalities[id][trait] === level.id ? 'selected' : ''}>${esc(level.label)}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}
        </table>
      </div>
    </div>`;
}

export function openPause(this: App) {
  const autosave = this.game?.state.autosaveEnabled !== false;
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal narrow" data-testid="pause-menu">
      <p class="eyebrow">Paused</p>
      <h2>Proxima</h2>
      <p class="muted">Version ${esc(APP_VERSION)}</p>
      <p data-testid="pause-difficulty">Difficulty: ${esc(difficultyLabel(this.game?.state.setup.difficulty))}. ${esc(difficultyProfile(this.game?.state.setup.difficulty).blurb)}</p>
      <h3>Audio</h3>
      ${renderAudioSettings(this.audio)}
      <h3>Saves</h3>
      <label class="row" data-testid="autosave-toggle"><input type="checkbox" data-setting="autosave" ${autosave ? 'checked' : ''}/> Autosave every ${autosaveIntervalTurns()} turns</label>
      <h3>Updates</h3>
      <label class="row" data-testid="update-check-toggle"><input type="checkbox" data-setting="updates" ${this.updateCheck ? 'checked' : ''}/> Check for updates when Proxima starts</label>
      <p class="muted">Off unless you turn it on. Proxima only notifies you. It never downloads or installs anything unless you ask.</p>
      <div class="stack">
        <button class="btn" data-action="pause-save" data-testid="pause-save">Save game</button>
        <button class="btn" data-action="pause-load" data-testid="pause-load">Load game</button>
        <button class="btn" data-action="pause-tutorial" data-testid="pause-tutorial">Tutorial</button>
        <button class="btn" data-action="pause-new" data-testid="pause-new">New game</button>
        <button class="btn danger" data-action="pause-exit" data-testid="pause-exit">Exit to desktop</button>
        <button class="btn primary" data-action="resume" data-testid="pause-resume">Resume</button>
      </div>
    </div></div>`;
}

export function openAudioPanel(this: App) {
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal narrow" data-testid="audio-panel">
      <p class="eyebrow">Before the expedition</p>
      <h2>Audio</h2>
      ${renderAudioSettings(this.audio)}
      <button class="btn primary" data-action="close" data-testid="audio-close">Close</button>
    </div></div>`;
}

export function askSaveFirst(this: App, mode: 'new' | 'exit') {
  this.pending = { mode };
  const save = mode === 'new' ? 'Save and Start New Game' : 'Save and Exit';
  const drop = mode === 'new' ? 'Start New Game Without Saving' : 'Exit Without Saving';
  this.overlay.innerHTML = `
    <div class="modal-back" data-testid="confirm-dialog"><div class="modal narrow">
      <h2>${mode === 'new' ? 'Start a new game?' : 'Exit to desktop?'}</h2>
      <div class="stack">
        <button class="btn primary" data-action="confirm-save" data-testid="confirm-save">${save}</button>
        <button class="btn danger" data-action="confirm-discard" data-testid="confirm-discard">${drop}</button>
        <button class="btn" data-action="confirm-cancel" data-testid="confirm-cancel">Cancel</button>
      </div>
    </div></div>`;
}

