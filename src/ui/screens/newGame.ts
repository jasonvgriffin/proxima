import type { App } from '../app';
import { CONFIG, MAP_SIZE_IDS, MAP_SIZES } from '../../config';
import { LEADERS } from '../../art/leaders';
import { difficultyLabel } from '../../core/difficulty';
import { FACTIONS, defaultAxes, PERSONALITY_LEVELS } from '../../core/factions';
import { Game } from '../../core/game';
import { FACTION_IDS, type Difficulty, type FactionId } from '../../core/types';
import { esc, prose, societySummary, axisEditor } from '../text';

export function renderSetup(this: App) {
  const faction = FACTIONS[this.setup.faction];
  const leader = LEADERS[this.setup.faction];
  this.stage.innerHTML = `
    <div class="sheet" data-testid="setup-screen">
      <div class="sheet-card">
        <p class="eyebrow">New expedition</p>
        <h2>Choose a faction</h2>
        <p class="muted">Difficulty: ${esc(difficultyLabel(this.setup.difficulty))}. Seed ${this.setup.seed}.</p>
        <div>
          <p class="muted">Map size</p>
          <div class="row" data-testid="map-size">
            ${MAP_SIZE_IDS.map((id) => {
              const spec = MAP_SIZES[id];
              return `<button class="btn small ${this.setup.mapSize === id ? 'on' : ''}" data-action="map-size" data-map-size="${id}" data-testid="map-size-${id}">${esc(spec.label)} · ${spec.width}×${spec.height}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="stack" data-testid="faction-list">
          ${FACTION_IDS.map((id) => this.factionButton(id)).join('')}
        </div>
        <div class="row">
          <button class="btn small" data-action="open-profile" data-testid="open-profile">Faction profile</button>
          <button class="btn small" data-action="reroll-seed">New seed</button>
          <button class="btn small" data-action="back-menu">Back</button>
        </div>
      </div>
      <div class="sheet-card setup-profile">
        <div class="profile-layout">
          <div class="profile-art">
            <canvas data-portrait="${faction.id}" width="480" height="480"></canvas>
            <canvas class="profile-crest" data-emblem="${faction.id}" width="128" height="128"></canvas>
          </div>
          <div>
            <p class="eyebrow">${esc(faction.formerly)}</p>
            <h2>${esc(faction.name)}</h2>
            <p class="leader-line"><strong>${esc(leader.name)}</strong> · ${esc(leader.title)}</p>
            <p>${esc(leader.line)}</p>
            <p class="tag">${esc(faction.idea)}</p>
            <p class="plays-like" data-testid="plays-like"><span>Plays like</span> ${esc(faction.playsLike)}</p>
          </div>
        </div>
        <div class="prose" data-testid="faction-backstory">${prose(faction.backstory)}</div>
        <p class="muted">Free starting tech: ${esc(faction.freeTechName)}.</p>
        <p class="muted" data-testid="society-summary">Society: ${esc(societySummary(this.setup.axes))}. Each match is +${Math.round(CONFIG.social.matchingBonus * 100)}%.</p>
        <div class="row">
          <button class="btn small ${this.customizeOpen ? 'on' : ''}" data-action="toggle-customize" data-testid="customize-faction" aria-expanded="${this.customizeOpen ? 'true' : 'false'}">Customize faction</button>
          <button class="btn primary" data-action="start-game" data-testid="start-game">Begin the expedition</button>
        </div>
        ${this.customizeOpen ? this.customizePanel() : ''}
      </div>
    </div>`;
  this.paintEmblems();
}

export function renderProfile(this: App) {
  const faction = FACTIONS[this.profileId];
  this.stage.innerHTML = `
    <div class="sheet" data-testid="profile-screen">
      <div class="sheet-card" style="grid-column: 1 / -1; max-width: 860px">
        <div class="profile-layout">
          <div class="profile-art">
            <canvas data-portrait="${faction.id}" width="480" height="480"></canvas>
            <canvas class="profile-crest" data-emblem="${faction.id}" width="128" height="128"></canvas>
          </div>
          <div>
            <p class="eyebrow">${esc(faction.formerly)}</p>
            <h2>${esc(faction.name)}</h2>
            <p class="leader-line"><strong>${esc(LEADERS[faction.id].name)}</strong> · ${esc(LEADERS[faction.id].title)}</p>
            <p>${esc(LEADERS[faction.id].line)}</p>
            <p class="plays-like"><span>Plays like</span> ${esc(faction.playsLike)}</p>
            <div class="prose">${prose(faction.backstory)}</div>
            <p class="muted">Look: ${esc(faction.visual)}</p>
            <p class="muted">Free starting tech: ${esc(faction.freeTechName)}.</p>
            <p class="muted">Society: ${esc(societySummary(defaultAxes(faction.id)))}.</p>
            <div class="bars" aria-hidden="true"><i style="background:${faction.colors.main}"></i><i style="background:${faction.colors.deep}"></i><i style="background:${faction.colors.ink}"></i></div>
          </div>
        </div>
        <button class="btn" data-action="profile-back" data-testid="profile-back">Back</button>
      </div>
    </div>`;
  this.paintEmblems();
}

export function startGame(this: App) {
  this.game = Game.newGame({
    seed: this.setup.seed,
    player: this.setup.faction,
    difficulty: this.setup.difficulty,
    alliedVictory: this.setup.allied,
    randomEvents: this.setup.events,
    personalities: this.setup.personalities,
    axes: this.setup.axes,
    autosaveEnabled: true,
    mapSize: this.setup.mapSize,
  });
  this.selectedUnit = this.game.unitsOf(this.setup.faction).find((unit) => unit.canFound)?.id ?? null;
  this.selectedCity = null;
  this.screen = 'game';
  this.gameMounted = false;
  this.render();
  this.audio.unlock();
  this.syncSoundscape();
}

export function customizePanel(this: App) {
  const id = this.setup.faction;
  const traits = Object.keys(PERSONALITY_LEVELS) as (keyof typeof PERSONALITY_LEVELS)[];
  const labels: Record<(typeof traits)[number], string> = {
    aggression: 'Aggression',
    expansion: 'Expansion',
    research: 'Research',
    diplomacy: 'Diplomacy',
    risk: 'Risk',
  };
  const personality = this.setup.personalities[id];
  return `<div class="faction-customize" data-testid="faction-customize">
    <p class="muted">Social axes start on this faction's strengths. Each match is +${Math.round(CONFIG.social.matchingBonus * 100)}%. Changing one later costs ${CONFIG.social.switchCost} credits.</p>
    ${axisEditor(this.setup.axes, 'setup-axis')}
    <p class="muted">Personality is how this faction acts when the AI plays it. Game Options on the start menu edits every rival the same way.</p>
    <div class="stack" data-testid="personality-editor">
      ${traits.map((trait) => `<label class="personality-row"><span class="muted">${labels[trait]}</span><select data-personality="${id}" data-trait="${trait}">${PERSONALITY_LEVELS[trait].map((level) => `<option value="${level.id}" ${personality[trait] === level.id ? 'selected' : ''}>${esc(level.label)}</option>`).join('')}</select></label>`).join('')}
    </div>
  </div>`;
}

export function factionButton(this: App, id: FactionId) {
  const faction = FACTIONS[id];
  const leader = LEADERS[id];
  return `<button class="faction-card ${this.setup.faction === id ? 'on' : ''}" data-action="pick-faction" data-faction="${id}" data-testid="faction-${id}"><canvas data-portrait="${id}" width="144" height="144"></canvas><canvas data-emblem="${id}" width="56" height="56"></canvas><span><strong>${esc(faction.name)}</strong><br/><span class="muted">${esc(leader.name)}</span></span></button>`;
}

