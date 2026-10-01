import { APP_VERSION } from '../version';
import { CONFIG } from '../config';
import { paintArkCanvas } from '../art/ark';
import { drawEmblem, drawPlanet, drawStar, drawStarfield } from '../art/draw';
import { LEADERS, leaderGreeting } from '../art/leaders';
import { drawPortrait, preloadLeaderPortraits, watchLeaderPortraits } from '../art/portraits';
import { unitContactSheetMarkup } from '../art/sheet';
import { paintUnitIcon, unitIconTag, unitKindFor } from '../art/units';
import { AudioBus, TRACKS } from '../audio/engine';
import { playLoggedCues, playTerraformProgress, snapshotLog, snapshotTerraform } from '../audio/listen';
import { difficultyLabel, difficultyProfile, normalizeDifficulty, outsideBandDamage } from '../core/difficulty';
import { FACTIONS, SOCIAL_OPTIONS, defaultAxes, defaultPersonalities, DIFFICULTIES, PERSONALITY_LEVELS } from '../core/factions';
import { Game, PROJECTS, projectLabel } from '../core/game';
import { proposalLabel } from '../core/diplomacy';
import { bundleText } from '../core/diplomacy';
import { eventPromptFor } from '../core/events';
import { tileYield } from '../core/economy';
import { biomeClass, formatCalendar, isSea, rushPayments, terraformEnergy, terraformFee, terraformTurns } from '../core/rules';
import { historyActor } from '../core/tilelog';
import { formerTechLevel, TECHS, techAvailable, techById } from '../core/tech';
import { renderTechTree } from './techtree';
import { starterDesigns, CHASSIS, WEAPONS, ARMORS, SPECIALS, partKnown } from '../core/parts';
import { FACTION_IDS, type Difficulty, type DiplomaticOffer, type FactionId, type Proposal, type SaveEnvelope, type SocialAxis, type Stance, type TradeBundle, type Unit } from '../core/types';
import { migrateSave, SAVE_VERSION } from '../platform/saveMigrate';
import { createSaveStore, type SaveStore } from '../platform/saves';
import { createPlatform, type PlatformClient, type UpdateNotice } from '../platform/updates';
import { renderDownloadConsent, renderDownloadDone, renderDownloadFailed, renderDownloadProgress, renderUpdateBanner, renderUpdatePrompt } from './updateUi';
import { IntroPlayer, INTRO_SCENES } from '../render/intro';
import { MapView } from '../render/mapview';
import { renderSocialRecap } from './recap';
import { renderTutorial } from './tutorial';

type Screen = 'menu' | 'intro' | 'setup' | 'options' | 'profile' | 'game' | 'recap';

export class App {
  private stage: HTMLElement;
  private overlay: HTMLElement;
  private audio = new AudioBus();
  private saves: SaveStore = createSaveStore();
  private platform: PlatformClient = createPlatform();
  private updateCheck = false;
  private updateNotice: UpdateNotice | null = null;
  private updateDismissed = false;
  private screen: Screen = 'menu';
  private game: Game | null = null;
  private introIndex = 0;
  private introPlayer: IntroPlayer | null = null;
  private map: MapView | null = null;
  private gameMounted = false;
  private backdrop = 0;
  private selectedUnit: number | null = null;
  private selectedCity: number | null = null;
  private focusTile: { x: number; y: number } | null = null;
  private preferTile = false;
  private reach = new Set<string>();
  private profileId: FactionId = 'helm';
  private profileReturn: Screen = 'menu';
  private customizeOpen = false;
  private diplomacyFocus: FactionId = 'verdantia';
  private pending: { mode: 'new' | 'exit' } | null = null;
  private treeCam = { x: 16, y: 12, zoom: 0.38 };
  private treeSelected: string | null = null;
  private treeNotice = '';
  private treeDidFit = false;
  private treeDrag: { x: number; y: number; panX: number; panY: number; pointer: number } | null = null;
  private setup = {
    faction: 'helm' as FactionId,
    difficulty: 'normal' as Difficulty,
    allied: false,
    events: false,
    personalities: defaultPersonalities(),
    axes: defaultAxes('helm'),
    seed: 1 + Math.floor(Math.random() * 999983),
  };

  constructor(root: HTMLElement) {
    root.innerHTML = '<div id="stage"></div><div id="update-banner"></div><div id="overlay"></div><div id="toast" hidden></div>';
    this.stage = root.querySelector('#stage')!;
    this.overlay = root.querySelector('#overlay')!;
    watchLeaderPortraits(() => this.paintEmblems());
    preloadLeaderPortraits();
    root.addEventListener('click', (event) => this.onClick(event));
    root.addEventListener('change', (event) => this.onChange(event));
    root.addEventListener('input', (event) => this.onInput(event));
    window.addEventListener('keydown', (event) => this.onKey(event));
    root.addEventListener('pointerover', (event) => this.onTreeHover(event));
    root.addEventListener('pointerdown', (event) => this.onTreePointerDown(event));
    window.addEventListener('pointermove', (event) => this.onTreePointerMove(event));
    window.addEventListener('pointerup', (event) => this.onTreePointerUp(event));
    root.addEventListener('wheel', (event) => this.onTreeWheel(event), { passive: false });
    root.addEventListener('pointerdown', (event) => {
      this.audio.unlock();
      const el = event.target instanceof Element ? event.target : null;
      if (el?.closest('[data-action="play-intro"]')) return;
      this.syncSoundscape();
    }, { once: true });
    if (import.meta.env.DEV) {
      window.__proximaDebug = {
        spawnRaider: () => this.spawnRaider(),
        showRecap: () => this.debugRecap(),
        showPortraits: () => this.showPortraitSheet(),
        showUnits: () => this.showUnitSheet(),
        seedDiplomacyOffer: () => this.seedDiplomacyOffer(),
        showDefeat: () => this.debugDefeat(),
        showTrade: () => this.debugTrade(),
        showEvent: () => this.debugEvent(),
        showTransport: () => this.debugTransport(),
        showMidgame: () => this.debugMidgame(),
        finishTerraform: () => this.debugFinishTerraform(),
        state: () => this.game?.serialize() ?? null,
        tilePoint: (x: number, y: number) => this.map?.clientPoint(x, y) ?? null,
        showUpdateBanner: () => this.previewUpdate(),
        showDownloadConsent: () => this.previewDownloadConsent(),
        showSaveError: () => this.showSaveError('Could not save the game, so Proxima stayed open.', new Error('Save file is unreadable (slot-1.json).')),
      };
    }
    this.render();
    void this.bootUpdates();
  }

  private render() {
    this.stopMotion();
    if (this.screen === 'menu') this.renderMenu();
    else if (this.screen === 'intro') this.renderIntro();
    else if (this.screen === 'setup') this.renderSetup();
    else if (this.screen === 'options') this.renderOptions();
    else if (this.screen === 'profile') this.renderProfile();
    else if (this.screen === 'recap') this.renderRecap();
    else this.mountGame();
    this.paintBanner();
    this.syncSoundscape();
  }

  private stopMotion() {
    cancelAnimationFrame(this.backdrop);
    this.introPlayer?.destroy();
    this.introPlayer = null;
    if (this.screen !== 'game') {
      this.map?.destroy();
      this.map = null;
      this.gameMounted = false;
    }
  }

  private renderMenu() {
    this.overlay.innerHTML = '';
    this.stage.innerHTML = `
      <div class="menu" data-testid="start-menu">
        <div class="menu-card">
          <p class="eyebrow">Year 2460 · Week 1</p>
          <h1>Proxima</h1>
          <p class="tag">Six factions woke in the wreck of Halcyon. The world is harsh on every face. One of them will decide what it becomes.</p>
          <div>
            <p class="muted">Difficulty</p>
            <div class="row" data-testid="difficulty">
              ${DIFFICULTIES.map((item) => `<button class="btn small ${this.setup.difficulty === item.id ? 'on' : ''}" data-action="difficulty" data-difficulty="${item.id}" data-testid="difficulty-${item.id}">${esc(item.label)}</button>`).join('')}
            </div>
            <p class="muted" data-testid="difficulty-blurb">${esc(difficultyProfile(this.setup.difficulty).blurb)}</p>
          </div>
          <label class="row"><input type="checkbox" data-setting="allied" ${this.setup.allied ? 'checked' : ''}/> Allied Victory</label>
          <label class="row"><input type="checkbox" data-setting="events" ${this.setup.events ? 'checked' : ''}/> Random events</label>
          <label class="row" data-testid="update-check-toggle"><input type="checkbox" data-setting="updates" ${this.updateCheck ? 'checked' : ''}/> Check for updates when Proxima starts</label>
          <div class="stack">
            <button class="btn primary" data-action="play-intro" data-testid="play-intro">Play Introduction</button>
            <button class="btn" data-action="new-game" data-testid="new-game">New Game</button>
            <button class="btn" data-action="load-game" data-testid="load-game">Load Game</button>
            <button class="btn" data-action="game-options" data-testid="game-options">Game Options</button>
            <button class="btn" data-action="menu-audio" data-testid="menu-audio">Audio</button>
            <button class="btn" data-action="quit" data-testid="quit">Quit</button>
          </div>
        </div>
        <canvas class="menu-bg" id="menu-bg"></canvas>
      </div>`;
    const canvas = this.stage.querySelector('#menu-bg') as HTMLCanvasElement;
    const loop = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawStarfield(ctx, rect.width, rect.height, t * 0.01);
        drawStar(ctx, rect.width * 0.28, rect.height * 0.32, 28, t * 0.001);
        drawPlanet(ctx, rect.width * 0.62, rect.height * 0.55, 110, t * 0.001);
      }
      this.backdrop = requestAnimationFrame(loop);
    };
    this.backdrop = requestAnimationFrame(loop);
  }

  private renderIntro() {
    const scene = INTRO_SCENES[this.introIndex];
    this.stage.innerHTML = `
      <div class="intro" data-testid="intro-screen">
        <canvas class="intro-canvas" id="intro-canvas" data-action="intro-next"></canvas>
        <div class="intro-bar">
          <div class="intro-copy">
            <p class="eyebrow">Introduction ${this.introIndex + 1} / ${INTRO_SCENES.length}</p>
            <h2>${esc(scene.title)}</h2>
            <p data-testid="intro-text">${esc(scene.text)}</p>
          </div>
          <div class="intro-actions">
            <button class="btn" data-action="intro-back" data-testid="intro-back" ${this.introIndex === 0 ? 'disabled' : ''}>Back</button>
            <button class="btn primary" data-action="intro-next" data-testid="intro-next">${this.introIndex === INTRO_SCENES.length - 1 ? 'Finish' : 'Next'}</button>
            <button class="btn" data-action="intro-skip" data-testid="intro-skip">Skip intro</button>
            <button class="btn" data-action="intro-exit" data-testid="intro-exit">Exit</button>
          </div>
        </div>
      </div>`;
    this.introPlayer = new IntroPlayer(this.stage.querySelector('#intro-canvas') as HTMLCanvasElement, () => this.introIndex);
  }

  private renderSetup() {
    const faction = FACTIONS[this.setup.faction];
    const leader = LEADERS[this.setup.faction];
    this.stage.innerHTML = `
      <div class="sheet" data-testid="setup-screen">
        <div class="sheet-card">
          <p class="eyebrow">New expedition</p>
          <h2>Choose a faction</h2>
          <p class="muted">Difficulty: ${esc(difficultyLabel(this.setup.difficulty))}. Seed ${this.setup.seed}.</p>
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
          <div class="prose" data-testid="faction-backstory">${this.prose(faction.backstory)}</div>
          <p class="muted">Free starting tech: ${esc(faction.freeTechName)}.</p>
          <p class="muted" data-testid="society-summary">Society: ${esc(this.societySummary(this.setup.axes))}. Each match is +${Math.round(CONFIG.social.matchingBonus * 100)}%.</p>
          <div class="row">
            <button class="btn small ${this.customizeOpen ? 'on' : ''}" data-action="toggle-customize" data-testid="customize-faction" aria-expanded="${this.customizeOpen ? 'true' : 'false'}">Customize faction</button>
            <button class="btn primary" data-action="start-game" data-testid="start-game">Begin in the twilight</button>
          </div>
          ${this.customizeOpen ? this.customizePanel() : ''}
        </div>
      </div>`;
    this.paintEmblems();
  }

  private renderOptions() {
    const traits = Object.keys(PERSONALITY_LEVELS) as (keyof typeof PERSONALITY_LEVELS)[];
    this.stage.innerHTML = `
      <div class="sheet">
        <div class="sheet-card" style="grid-column: 1 / -1">
          <p class="eyebrow">Game options</p>
          <h2>Rival personalities</h2>
          <p class="muted">Difficulty on the start menu sets how soon rivals attack. A change here overrides that rival's own temperament.</p>
          <table class="grid">
            <tr><th>Faction</th>${traits.map((trait) => `<th>${esc(trait)}</th>`).join('')}</tr>
            ${FACTION_IDS.map((id) => `<tr><td>${esc(FACTIONS[id].name)}</td>${traits.map((trait) => `<td><select data-personality="${id}" data-trait="${trait}">${PERSONALITY_LEVELS[trait].map((level) => `<option value="${level.id}" ${this.setup.personalities[id][trait] === level.id ? 'selected' : ''}>${esc(level.label)}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}
          </table>
          <button class="btn" data-action="back-menu">Back to start</button>
        </div>
      </div>`;
  }

  private renderProfile() {
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
              <div class="prose">${this.prose(faction.backstory)}</div>
              <p class="muted">Look: ${esc(faction.visual)}</p>
              <p class="muted">Free starting tech: ${esc(faction.freeTechName)}.</p>
              <p class="muted">Society: ${esc(this.societySummary(defaultAxes(faction.id)))}.</p>
              <div class="bars" aria-hidden="true"><i style="background:${faction.colors.main}"></i><i style="background:${faction.colors.deep}"></i><i style="background:${faction.colors.ink}"></i></div>
            </div>
          </div>
          <button class="btn" data-action="profile-back" data-testid="profile-back">Back</button>
        </div>
      </div>`;
    this.paintEmblems();
  }

  private renderRecap() {
    renderSocialRecap(this.stage, this.game, this.setup.faction);
  }

  private mountGame() {
    const game = this.game;
    if (!game) return;
    if (!this.gameMounted) {
      this.stage.innerHTML = `
        <div class="game" data-testid="game-screen">
          <header class="topbar" id="topbar"></header>
          <aside class="side" id="left"></aside>
          <div id="map-wrap"><canvas id="map-canvas" data-testid="map-canvas"></canvas></div>
          <aside class="side right" id="right"></aside>
          <section class="log" id="log"></section>
        </div>`;
      this.map = new MapView(
        this.stage.querySelector('#map-canvas') as HTMLCanvasElement,
        () => this.game!,
        () => ({ unitId: this.selectedUnit, cityId: this.selectedCity, reach: this.reach }),
        (x, y, mods) => this.onTile(x, y, mods),
        (label) => {
          const node = this.stage.querySelector('#hover-label');
          if (node) node.textContent = label;
        },
      );
      const placeCamera = () => {
        const home = this.game?.unitsOf(this.game.state.playerFaction)[0];
        if (home && this.map) this.map.centerOn(home.x, home.y);
      };
      placeCamera();
      requestAnimationFrame(placeCamera);
      this.gameMounted = true;
    }
    this.refreshGame();
  }

  private refreshGame() {
    const game = this.game;
    if (!game || !this.gameMounted) return;
    game.noteSight();
    const faction = game.state.factions[game.state.playerFaction];
    const rates = game.ratesFor(game.state.playerFaction);
    const cal = game.calendar();
    const research = faction.researching ? techById(faction.researching) : undefined;
    this.stage.querySelector('#topbar')!.innerHTML = `
      <strong class="brand">Proxima</strong>
      <div data-testid="calendar">${esc(cal.label)}</div>
      <div data-testid="hud-difficulty">${esc(difficultyLabel(game.state.setup.difficulty))}</div>
      <div class="resources">
        <div class="chip"><span>Minerals</span><b>${rates.minerals}/t</b></div>
        <div class="chip"><span>Nutrients</span><b>${rates.nutrients}/t</b></div>
        <div class="chip"><span>Energy</span><b>${faction.energy}</b></div>
        <button type="button" class="chip chip-btn" data-action="open-research" data-testid="research-chip"><span>Research</span><b>${research ? `${faction.researchPoints}/${research.cost}` : faction.researchPoints}</b></button>
        <div class="chip"><span>Credits</span><b>${faction.credits}</b></div>
      </div>
      <button class="btn small ${this.map?.showTerraform ? 'on' : ''}" data-action="toggle-terraform-overlay" data-testid="terraform-overlay">Terraform</button>
      <button class="btn small" data-action="open-diplomacy" data-testid="open-diplomacy">Diplomacy</button>
      <button class="btn small" data-action="open-spies" data-testid="open-spies">Spies</button>
      <button class="btn small" data-action="open-research" data-testid="open-research">Tech Tree</button>
      <button class="btn primary" data-action="end-turn" data-testid="end-turn">End Turn</button>`;
    const units = game.unitsOf(game.state.playerFaction);
    const cities = game.citiesOf(game.state.playerFaction);
    this.stage.querySelector('#left')!.innerHTML = `
      <h3>Forces</h3>
      <div data-testid="unit-list">
        ${units.map((unit) => `<button class="unit-btn ${unit.id === this.selectedUnit ? 'on' : ''}" data-action="select-unit" data-id="${unit.id}" data-testid="unit-${unit.id}" data-role="${unit.role}">${this.unitIcon(unit)}<span>${esc(unit.name)} · ${unit.hp}/${unit.maxHp} · ${unit.movesLeft} mp${unit.searching ? ' · search' : ''}${unit.terraform ? ' · working' : ''}${unit.aboard != null ? ' · aboard' : ''}${unit.cargo.length ? ` · carrying ${unit.cargo.length}` : ''}</span></button>`).join('') || '<p class="muted">No units.</p>'}
      </div>
      <h3>Cities</h3>
      <div data-testid="city-list">
        ${cities.map((city) => `<button class="city-btn ${city.id === this.selectedCity ? 'on' : ''}" data-action="select-city" data-id="${city.id}">${esc(city.name)} · pop ${city.population}</button>`).join('') || '<p class="muted">No cities yet.</p>'}
      </div>`;
    this.stage.querySelector('#right')!.innerHTML = this.inspector();
    const lines = game.state.log.slice(-8);
    this.stage.querySelector('#log')!.innerHTML = `<ul data-testid="log">${lines.map((line) => `<li>${esc(line.text)}</li>`).join('')}</ul><p class="muted" id="hover-label"></p>`;
    this.reach = new Set();
    if (this.selectedUnit != null) {
      for (const [key, step] of game.reachable(this.selectedUnit)) if (step.cost > 0) this.reach.add(key);
    }
    if (game.state.winner && !this.overlay.innerHTML) this.openVictory();
    else if (game.state.playerDefeated && !this.overlay.innerHTML) this.openDefeat();
    else if (game.state.events.prompt && !this.overlay.innerHTML) this.openEvent();
    this.paintEmblems();
  }

  private unitIcon(unit: Unit, large = false): string {
    const faction = FACTIONS[unit.factionId];
    const design = this.game?.findDesign(unit.factionId, unit.designId);
    return unitIconTag({
      role: unit.role,
      domain: unit.domain,
      chassis: design?.chassis,
      specials: design?.specials,
      name: unit.name,
      color: faction.colors.main,
      deep: faction.colors.deep,
      hp: unit.hp,
      maxHp: unit.maxHp,
      selected: unit.id === this.selectedUnit,
      working: !!unit.terraform,
      large,
      phase: 0.9,
    });
  }

  private inspector(): string {
    const game = this.game!;
    if (this.preferTile && this.focusTile) return this.tilePanel();
    const unit = this.selectedUnit != null ? game.unitById(this.selectedUnit) : undefined;
    const city = this.selectedCity != null ? game.state.cities.find((entry) => entry.id === this.selectedCity) : undefined;
    if (unit && unit.factionId === game.state.playerFaction) {
      const foe = this.adjacentFoe(unit);
      const riders = unit.cargo.map((id) => game.unitById(id)).filter((entry): entry is Unit => !!entry);
      const boarding = unit.transport > 0 ? game.boardableUnits(unit.id) : [];
      const drops = unit.cargo.length ? game.coastalDrops(unit.id) : [];
      return `
        ${this.unitIcon(unit, true)}
        <h3>${esc(unit.name)}</h3>
        <p class="muted">${esc(unit.role)} · atk ${unit.attack} · def ${unit.defense} · move ${unit.movesLeft}/${unit.maxMoves}${unit.transport ? ` · transport ${unit.cargo.length}/${unit.transport}` : ''}</p>
        ${unit.aboard != null ? '<p>Aboard a ship. It unloads on a coastal tile.</p>' : ''}
        <div class="stack">
          ${unit.canFound ? `<button class="btn primary" data-action="found-city" data-testid="found-city">Found city</button>` : ''}
          ${unit.canTerraform ? `<button class="btn" data-action="terraform-open" data-testid="terraform-open">Terraform this tile</button>` : ''}
          <button class="btn" data-action="show-tile" data-testid="show-tile">This tile</button>
          <button class="btn" data-action="toggle-search" data-testid="search-toggle">${unit.searching ? 'Stop searching' : 'Search'}</button>
          ${foe ? `<button class="btn danger" data-action="attack" data-testid="attack-btn">Attack ${esc(foe.name)}</button>` : ''}
          ${boarding.map((other) => `<button class="btn" data-action="load-unit" data-transport="${unit.id}" data-passenger="${other.id}" data-testid="load-unit">Load ${esc(other.name)}</button>`).join('')}
          ${riders.flatMap((rider) => drops.slice(0, 3).map((drop) => `<button class="btn" data-action="unload-unit" data-transport="${unit.id}" data-passenger="${rider.id}" data-x="${drop.x}" data-y="${drop.y}" data-testid="unload-unit">Unload ${esc(rider.name)} at ${drop.x},${drop.y}</button>`)).join('')}
        </div>
        ${unit.terraform ? `<p>Working on ${esc(projectLabel(unit.terraform.project))}, ${unit.terraform.turnsLeft} turns left.</p>` : ''}
        <div class="stack">
          <button class="btn small" data-action="open-social">Society</button>
          <button class="btn small" data-action="open-design">Design a unit</button>
          <button class="btn small" data-action="open-profile-game">Faction profile</button>
        </div>`;
    }
    if (city && city.factionId === game.state.playerFaction) {
      const report = game.cityReport(city.id);
      const designs = game.designsFor(city.factionId);
      return `
        <h3>${esc(city.name)}</h3>
        <p class="muted">Population ${city.population}. Credits ${report?.credits ?? 0}/turn. Nutrients ${report?.yields.nutrients ?? 0} (need ${report?.need ?? 0}).</p>
        <div class="build-list" data-testid="build-list">
          ${designs.map((design) => `<button type="button" class="build-card ${city.production?.designId === design.id ? 'on' : ''}" data-action="set-production" data-city="${city.id}" data-design="${design.id}">${unitIconTag({ role: design.role, domain: design.domain, chassis: design.chassis, specials: design.specials, name: design.name, color: FACTIONS[city.factionId].colors.main, deep: FACTIONS[city.factionId].colors.deep })}<span>${esc(design.name)}</span></button>`).join('')}
        </div>
        <label>Production
          <select data-city="${city.id}" data-setting="production">
            <option value="">Choose a design</option>
            ${designs.map((design) => `<option value="${design.id}" ${city.production?.designId === design.id ? 'selected' : ''}>${esc(design.name)} (${design.cost})</option>`).join('')}
          </select>
        </label>
        ${city.production ? `<p>${city.production.progress} / ${city.production.cost}</p><button class="btn" data-action="rush" data-city="${city.id}" data-testid="rush-buy">Rush-buy (${rushPayments(city.production.cost - city.production.progress).credits} credits + stockpile)</button>` : ''}
        <p class="muted">Income is 1 credit per population plus 2, before social bonuses.</p>
        <button class="btn" data-action="show-tile" data-testid="show-tile">This tile</button>`;
    }
    if (this.focusTile) return this.tilePanel();
    return `<h3>${esc(FACTIONS[game.state.playerFaction].name)}</h3><p class="muted">Select a unit, a city, or a map tile. Press I over a tile, or shift-click it, for its history. Press T for the tech tree. The gold lines on the map are the edges of the twilight band. Outside it, units take ${outsideBandDamage(game.state.setup.difficulty)} damage a turn until Sealed Habitats / Geothermal Wells.</p>`;
  }

  private tilePanel(): string {
    const game = this.game!;
    const focus = this.focusTile;
    if (!focus) return '';
    const view = game.tileView(focus.x, focus.y);
    const back = this.selectedUnit != null || this.selectedCity != null
      ? `<button class="btn" data-action="hide-tile" data-testid="hide-tile">Back</button>`
      : '';
    if (view.kind === 'hidden') {
      return `<div data-testid="tile-panel"><h3>Unexplored</h3><p>This square is still hidden.</p>${back}</div>`;
    }
    if (view.kind === 'forgotten') {
      return `<div data-testid="tile-panel"><h3>Remembered tile</h3><p data-testid="tile-stale">You have seen this square, but Proxima has no record of what was last here. It may have changed.</p>${back}</div>`;
    }
    const sight = view.sight!;
    const asTile = (improvement: typeof sight.improvement) => ({
      x: focus.x,
      y: focus.y,
      zone: sight.zone,
      terrain: sight.terrain,
      resource: sight.resource,
      improvement,
      livable: sight.livable,
      road: sight.road,
      scarred: sight.scarred,
      history: [],
    });
    const bare = tileYield(asTile(null));
    const now = tileYield(asTile(sight.improvement));
    const yieldText = (['minerals', 'nutrients', 'energy', 'research'] as const)
      .map((key) => (now[key] === bare[key] ? `${key} ${now[key]}` : `${key} ${bare[key]} → ${now[key]}`))
      .join(', ');
    const zone = sight.zone === 'twilight' ? 'Twilight band' : sight.zone === 'day' ? 'Day side' : 'Night side';
    const lines = view.lines?.length ? view.lines.join(', ') : 'No terraform improvements';
    const stale = view.kind === 'stale'
      ? `<p data-testid="tile-stale">Last seen. This may be out of date.</p>`
      : '';
    const working = sight.working
      ? `<p data-testid="tile-working">${esc(sight.working.unitName)} is building ${esc(projectLabel(sight.working.project))}, ${sight.working.turnsLeft} turns left.</p>`
      : '';
    const history = sight.history.length
      ? sight.history.map((entry) => `<li>${esc(formatCalendar(entry.round))}: ${esc(historyActor(entry, (id) => FACTIONS[id].name))} — ${esc(entry.change)}</li>`).join('')
      : '<li>No terraform history yet.</li>';
    return `
      <div data-testid="tile-panel">
        <h3>${focus.x}, ${focus.y}</h3>
        ${stale}
        <p data-testid="tile-state">${esc(zone)} · ${esc(sight.terrain.replace('-', ' '))}${sight.resource ? ` · ${esc(sight.resource)}` : ''}</p>
        <p data-testid="tile-improvements">${esc(lines)}</p>
        <p data-testid="tile-yields">${esc(yieldText)}</p>
        ${working}
        <h3>History</h3>
        <ul data-testid="tile-history">${history}</ul>
        ${back}
      </div>`;
  }

  private openTile(x: number, y: number) {
    this.focusTile = { x, y };
    this.preferTile = true;
    this.refreshGame();
  }

  private onTile(x: number, y: number, mods: { shift: boolean; alt: boolean } = { shift: false, alt: false }) {
    const game = this.game;
    if (!game) return;
    if (mods.shift || mods.alt) {
      this.openTile(x, y);
      return;
    }
    const selected = this.selectedUnit != null ? game.unitById(this.selectedUnit) : undefined;
    if (selected && this.reach.has(`${x},${y}`)) {
      const moved = game.moveUnit(selected.id, x, y);
      this.audio.play(moved.ok ? 'move' : 'error');
      this.toast(moved.message);
      this.refreshGame();
      return;
    }
    if (selected) {
      const preview = game.previewAttack(selected.id, x, y);
      if (preview.ok) {
        this.openCombat(selected.id, x, y);
        return;
      }
    }
    const own = game.state.units.find((unit) => unit.x === x && unit.y === y && unit.factionId === game.state.playerFaction && unit.aboard == null);
    if (own) {
      this.selectedUnit = own.id;
      this.selectedCity = null;
      this.focusTile = { x, y };
      this.preferTile = false;
      this.refreshGame();
      return;
    }
    const city = game.cityAt(x, y);
    if (city && city.factionId === game.state.playerFaction) {
      this.selectedCity = city.id;
      this.selectedUnit = null;
      this.focusTile = { x, y };
      this.preferTile = false;
      this.refreshGame();
      return;
    }
    this.openTile(x, y);
  }

  private async onClick(event: MouseEvent) {
    const node = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!node) return;
    const action = node.dataset.action;
    if (await this.handleUpdateAction(action, node)) return;
    if (action === 'play-intro') {
      this.introIndex = 0;
      this.screen = 'intro';
      this.render();
    } else if (action === 'intro-next') {
      if (this.introIndex >= INTRO_SCENES.length - 1) this.exitIntro();
      else {
        this.introIndex += 1;
        this.render();
      }
    } else if (action === 'intro-skip') this.exitIntro();
    else if (action === 'intro-back') {
      if (this.introIndex > 0) {
        this.introIndex -= 1;
        this.render();
      }
    } else if (action === 'intro-exit') this.exitIntro();
    else if (action === 'new-game') {
      this.customizeOpen = false;
      this.screen = 'setup';
      this.render();
    } else if (action === 'back-menu') {
      this.screen = 'menu';
      this.game = null;
      this.render();
    } else if (action === 'game-options') {
      this.screen = 'options';
      this.render();
    } else if (action === 'menu-audio') this.openAudioPanel();
    else if (action === 'quit') void this.exitDesktop();
    else if (action === 'difficulty') this.setup.difficulty = normalizeDifficulty(node.dataset.difficulty);
    else if (action === 'pick-faction') {
      this.setup.faction = node.dataset.faction as FactionId;
      this.setup.axes = defaultAxes(this.setup.faction);
      this.render();
    } else if (action === 'open-profile') {
      this.profileId = this.setup.faction;
      this.profileReturn = 'setup';
      this.screen = 'profile';
      this.render();
    } else if (action === 'open-profile-game') {
      this.profileId = this.game?.state.playerFaction ?? 'helm';
      this.profileReturn = 'game';
      this.screen = 'profile';
      this.render();
    } else if (action === 'profile-back') {
      this.screen = this.profileReturn;
      this.render();
    } else if (action === 'reroll-seed') {
      this.setup.seed = 1 + Math.floor(Math.random() * 999983);
      this.render();
    } else if (action === 'toggle-customize') {
      this.customizeOpen = !this.customizeOpen;
      this.render();
    } else if (action === 'setup-axis') {
      const axis = node.dataset.axis as SocialAxis;
      this.setup.axes[axis] = node.dataset.option ?? this.setup.axes[axis];
      this.render();
    } else if (action === 'start-game') this.startGame();
    else if (action === 'load-game') await this.runSave(() => this.openLoad(false), 'Could not open the save list.');
    else if (action === 'end-turn') await this.endTurn();
    else if (action === 'select-unit') {
      this.selectedUnit = Number(node.dataset.id);
      this.selectedCity = null;
      this.preferTile = false;
      const unit = this.game?.unitById(this.selectedUnit);
      if (unit) this.focusTile = { x: unit.x, y: unit.y };
      this.refreshGame();
    } else if (action === 'select-city') {
      this.selectedCity = Number(node.dataset.id);
      this.selectedUnit = null;
      this.preferTile = false;
      const city = this.game?.state.cities.find((entry) => entry.id === this.selectedCity);
      if (city) this.focusTile = { x: city.x, y: city.y };
      this.refreshGame();
    } else if (action === 'show-tile') {
      const unit = this.selectedUnit != null ? this.game?.unitById(this.selectedUnit) : undefined;
      const city = this.selectedCity != null ? this.game?.state.cities.find((entry) => entry.id === this.selectedCity) : undefined;
      const at = unit ?? city ?? this.focusTile;
      if (at) this.openTile(at.x, at.y);
    } else if (action === 'hide-tile') {
      this.preferTile = false;
      this.refreshGame();
    } else if (action === 'toggle-terraform-overlay') {
      if (this.map) this.map.showTerraform = !this.map.showTerraform;
      this.refreshGame();
    } else if (action === 'found-city' && this.selectedUnit != null) this.act(() => this.game!.foundCity(this.selectedUnit!), 'found');
    else if (action === 'terraform-open') this.openTerraform();
    else if (action === 'terraform-pick' && this.selectedUnit != null) {
      const project = node.dataset.project as 'farm';
      this.closeOverlay();
      this.act(() => this.game!.startTerraform(this.selectedUnit!, project), 'terraform');
    } else if (action === 'toggle-search' && this.selectedUnit != null) this.act(() => this.game!.toggleSearch(this.selectedUnit!), 'click');
    else if (action === 'attack') {
      const unit = this.selectedUnit != null ? this.game?.unitById(this.selectedUnit) : undefined;
      const foe = unit ? this.adjacentFoe(unit) : undefined;
      if (unit && foe) this.openCombat(unit.id, foe.x, foe.y);
    } else if (action === 'combat-cancel') this.closeOverlay();
    else if (action === 'combat-confirm') {
      const attacker = Number(node.dataset.attacker);
      const x = Number(node.dataset.x);
      const y = Number(node.dataset.y);
      this.closeOverlay();
      this.act(() => this.game!.confirmAttack(attacker, x, y), 'attack');
    } else if (action === 'open-diplomacy') this.openDiplomacy();
    else if (action === 'select-diplomat') {
      const id = node.dataset.faction as FactionId | undefined;
      if (id && id !== this.game?.state.playerFaction) {
        this.diplomacyFocus = id;
        this.openDiplomacy();
      }
    }
    else if (action === 'open-spies') this.openSpies();
    else if (action === 'open-social') this.openSocial();
    else if (action === 'open-research') this.openTechTree();
    else if (action === 'tech-node' || action === 'tech-research' || action === 'tech-goal') this.pickTech(node.dataset.tech ?? '', action);
    else if (action === 'tree-zoom-in') {
      this.treeCam.zoom = Math.min(1.5, this.treeCam.zoom * 1.12);
      this.applyTreeCam();
    } else if (action === 'tree-zoom-out') {
      this.treeCam.zoom = Math.max(0.22, this.treeCam.zoom / 1.12);
      this.applyTreeCam();
    } else if (action === 'tree-fit') this.fitTree();
    else if (action === 'open-design') this.openDesign();
    else if (action === 'propose') this.act(() => this.game!.propose(node.dataset.target as FactionId, node.dataset.kind as Proposal | 'war'), 'click');
    else if (action === 'accept-offer') this.act(() => this.game!.acceptOffer(Number(node.dataset.id)), 'click');
    else if (action === 'reject-offer') this.act(() => this.game!.rejectOffer(Number(node.dataset.id)), 'click');
    else if (action === 'recruit-spy') this.act(() => this.game!.recruitSpy(), 'click');
    else if (action === 'place-spy') {
      const host = (this.overlay.querySelector(`[data-spy-host="${node.dataset.id}"]`) as HTMLSelectElement | null)?.value as FactionId | undefined;
      if (host) this.act(() => this.game!.placeSpy(Number(node.dataset.id), host), 'click');
    } else if (action === 'steal-tech') this.act(() => this.game!.stealTech(Number(node.dataset.id), node.dataset.tech ?? ''), 'click');
    else if (action === 'sabotage') this.act(() => this.game!.sabotage(Number(node.dataset.id)), 'click');
    else if (action === 'frame') {
      const section = node.closest('section');
      const left = (section?.querySelector('[data-frame="left"]') as HTMLSelectElement | null)?.value as FactionId | undefined;
      const right = (section?.querySelector('[data-frame="right"]') as HTMLSelectElement | null)?.value as FactionId | undefined;
      if (left && right) this.act(() => this.game!.frameJob(Number(node.dataset.id), left, right), 'click');
    } else if (action === 'sweep') this.act(() => this.game!.sweepSpies(), 'click');
    else if (action === 'switch-axis') this.act(() => this.game!.setSocial(node.dataset.axis as SocialAxis, node.dataset.option ?? ''), 'click');
    else if (action === 'research-pick') this.act(() => this.game!.chooseResearch(node.dataset.tech ?? ''), 'click');
    else if (action === 'save-design') this.saveDesign();
    else if (action === 'set-production' && this.game) {
      this.act(() => this.game!.setProduction(Number(node.dataset.city), node.dataset.design ?? ''), 'click');
    } else if (action === 'rush') this.act(() => this.game!.rushBuy(Number(node.dataset.city)), 'click');
    else if (action === 'open-trade') this.openTrade(node.dataset.target as FactionId);
    else if (action === 'send-trade') this.sendTrade(node.dataset.target as FactionId);
    else if (action === 'event-choice') {
      this.act(() => this.game!.chooseEvent(node.dataset.choice ?? ''), 'click');
    }
    else if (action === 'load-unit') this.act(() => this.game!.loadUnit(Number(node.dataset.transport), Number(node.dataset.passenger)), 'click');
    else if (action === 'unload-unit') {
      this.act(() => this.game!.unloadUnit(Number(node.dataset.transport), Number(node.dataset.passenger), Number(node.dataset.x), Number(node.dataset.y)), 'click');
    }
    else if (action === 'close') this.closeOverlay();
    else if (action === 'resume') this.closeOverlay();
    else if (action === 'pause-save') await this.runSave(() => this.openSave('manual'), 'Could not open the save list.');
    else if (action === 'pause-load') await this.runSave(() => this.openLoad(true), 'Could not open the save list.');
    else if (action === 'pause-tutorial' || action === 'tutorial-next' || action === 'tutorial-back') {
      const step = action === 'pause-tutorial' ? 0 : Number(node.dataset.step) + (action === 'tutorial-next' ? 1 : -1);
      this.overlay.innerHTML = renderTutorial(step);
      this.paintEmblems();
    }
    else if (action === 'pause-new') this.askSaveFirst('new');
    else if (action === 'pause-exit') this.askSaveFirst('exit');
    else if (action === 'confirm-cancel') this.closeOverlay();
    else if (action === 'confirm-discard') void this.finishPending(false);
    else if (action === 'confirm-save') await this.runSave(() => this.openSave(this.pending?.mode === 'exit' ? 'then-exit' : 'then-new'), 'Could not open the save list. Proxima stayed open.');
    else if (action === 'save-slot') await this.runSave(() => this.writeSlot(Number(node.dataset.slot), node.dataset.purpose ?? 'manual'), 'Could not save the game. Proxima stayed open.');
    else if (action === 'load-slot') await this.runSave(() => this.readSlot(Number(node.dataset.slot)), 'Could not load that save.');
    else if (action === 'view-recap') {
      this.screen = 'recap';
      this.render();
    }
    if (action === 'difficulty') this.render();
    this.afterActionRefresh(action);
  }

  private afterActionRefresh(action: string | undefined) {
    const overlays = ['propose', 'accept-offer', 'reject-offer', 'recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep', 'switch-axis', 'research-pick', 'tech-node', 'tech-research', 'tech-goal', 'save-design', 'rush'];
    if (action && overlays.includes(action) && this.screen === 'game') {
      if (action === 'open-diplomacy' || action.startsWith('propose') || action.includes('offer')) this.openDiplomacy();
      else if (['recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep'].includes(action)) this.openSpies();
      else if (action === 'switch-axis') this.openSocial();
      else if (action === 'research-pick' || action === 'tech-node' || action === 'tech-research' || action === 'tech-goal') this.openTechTree();
      else this.refreshGame();
    }
  }

  private onChange(event: Event) {
    if (this.applyAudioSettings(event)) return;
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.setting === 'allied') this.setup.allied = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'events') this.setup.events = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'autosave' && this.game) {
      this.game.state.autosaveEnabled = (target as HTMLInputElement).checked;
    }
    if (target.dataset.setting === 'updates') {
      this.updateCheck = (target as HTMLInputElement).checked;
      void this.persistUpdateCheck(this.updateCheck);
    }
    if (target.dataset.personality && target.dataset.trait) {
      const id = target.dataset.personality as FactionId;
      const trait = target.dataset.trait as keyof (typeof this.setup.personalities)[FactionId];
      this.setup.personalities[id] = { ...this.setup.personalities[id], [trait]: target.value };
    }
    if (target.dataset.setting === 'production' && this.game) {
      const design = target.value;
      if (design) this.act(() => this.game!.setProduction(Number(target.dataset.city), design), 'click');
    }
    if (target.id === 'design-chassis') this.paintDesignPreview();
  }

  private onInput(event: Event) {
    this.applyAudioSettings(event);
  }

  private startGame() {
    this.game = Game.newGame({
      seed: this.setup.seed,
      player: this.setup.faction,
      difficulty: this.setup.difficulty,
      alliedVictory: this.setup.allied,
      randomEvents: this.setup.events,
      personalities: this.setup.personalities,
      axes: this.setup.axes,
      autosaveEnabled: true,
    });
    this.selectedUnit = this.game.unitsOf(this.setup.faction).find((unit) => unit.canFound)?.id ?? null;
    this.selectedCity = null;
    this.screen = 'game';
    this.gameMounted = false;
    this.render();
    this.audio.unlock();
    this.syncSoundscape();
  }

  private async endTurn() {
    const game = this.game;
    if (!game) return;
    const player = game.state.factions[game.state.playerFaction];
    const researchBefore = { techs: [...player.techs], researching: player.researching };
    const logBefore = snapshotLog(game.state.log);
    const workBefore = snapshotTerraform(game.state.units, game.state.playerFaction);
    const ended = game.endTurn();
    this.audio.play('turn');
    playTerraformProgress(this.audio, workBefore, snapshotTerraform(game.state.units, game.state.playerFaction));
    playLoggedCues(this.audio, logBefore, game.state.log, game.state.playerFaction);
    this.toast(ended.message);
    this.refreshGame();
    if (ended.autosave) await this.runSave(() => this.writeSlot(0, 'autosave'), 'Autosave failed. Your game is still running.');
    this.maybePromptResearch(researchBefore);
  }

  private act(fn: () => { ok: boolean; message: string }, sound: 'click' | 'found' | 'terraform' | 'attack') {
    const logBefore = snapshotLog(this.game?.state.log ?? []);
    const result = fn();
    this.audio.play(result.ok ? sound : 'error');
    playLoggedCues(this.audio, logBefore, this.game?.state.log ?? [], this.game?.state.playerFaction ?? '');
    this.toast(result.message);
    if (this.screen === 'game') this.refreshGame();
    return result;
  }

  private openCombat(attackerId: number, x: number, y: number) {
    const preview = this.game!.previewAttack(attackerId, x, y);
    if (!preview.ok) {
      this.toast(preview.message);
      return;
    }
    this.overlay.innerHTML = `
      <div class="modal-back" data-testid="combat-modal">
        <div class="modal narrow">
          <p class="eyebrow">Confirm attack</p>
          <h2>${esc(preview.attackerName)} against ${esc(preview.defenderName)}</h2>
          <p data-testid="combat-odds" style="font-family:var(--display);font-size:42px;color:var(--gold)">${preview.percent}%</p>
          <p class="muted">Chance the attacker wins. Terrain ${esc(preview.terrain.replace('-', ' '))} modifies defense by ${preview.terrainMod >= 0 ? '+' : ''}${Math.round(preview.terrainMod * 100)}%.</p>
          ${preview.city && preview.navalBombardment ? '<p>A ship can weaken a city. It cannot capture one.</p>' : ''}
          <div class="row">
            <button class="btn danger" data-action="combat-confirm" data-testid="combat-confirm" data-attacker="${attackerId}" data-x="${x}" data-y="${y}">Attack</button>
            <button class="btn" data-action="combat-cancel" data-testid="combat-cancel">Cancel</button>
          </div>
        </div>
      </div>`;
  }

  private openTerraform() {
    const game = this.game!;
    const unit = game.unitById(this.selectedUnit ?? -1);
    if (!unit) return;
    const tile = game.tile(unit.x, unit.y);
    const fee = terraformFee(biomeClass(tile));
    const level = formerTechLevel(game.state.factions[unit.factionId].techs);
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="terraform-menu">
        <h2>Terraform</h2>
        <p class="muted">Fee ${fee} credits plus energy on this ${esc(biomeClass(tile))} tile. Tech level ${level}. Only atmosphere work makes a tile livable. One terraformer to a tile, and they can work anywhere.</p>
        <div class="stack">
          ${PROJECTS.map((project) => {
            const turns = terraformTurns(project.id, level);
            const locked = project.id === 'atmosphere' && !game.state.factions[unit.factionId].techs.includes('atmosphere');
            const energy = terraformEnergy(project.id);
            return `<button class="btn" data-action="terraform-pick" data-project="${project.id}" data-testid="terraform-${project.id}" ${locked ? 'disabled' : ''}>${esc(project.label)} · ${turns} turns · ${energy} energy · ${esc(project.detail)}</button>`;
          }).join('')}
        </div>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
  }

  private openDiplomacy() {
    const game = this.game!;
    const me = game.state.playerFaction;
    const others = FACTION_IDS.filter((id) => id !== me);
    if (!others.includes(this.diplomacyFocus)) this.diplomacyFocus = others[0];
    const focus = this.diplomacyFocus;
    const focusRel = game.relation(me, focus);
    const leader = LEADERS[focus];
    const offers = game.state.offers.filter((offer) => offer.to === me);
    this.overlay.innerHTML = diplomacyMarkup({
      offers: offers.map((offer) => ({
        id: offer.id,
        from: offer.from,
        fromName: FACTIONS[offer.from].name,
        kind: offer.kind,
        label: offer.kind === 'trade'
          ? `${bundleText(offer.trade?.give ?? { credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null })} for ${bundleText(offer.trade?.want ?? { credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null })}`
          : proposalLabel(offer.kind),
      })),
      focus: {
        factionId: focus,
        factionName: FACTIONS[focus].name,
        leader: leader.name,
        title: leader.title,
        greeting: leaderGreeting(focus, focusRel.stance),
      },
      factions: others.map((id) => {
        const rel = game.relation(me, id);
        return {
          id,
          name: FACTIONS[id].name,
          leader: LEADERS[id].name,
          stance: rel.stance,
          memory: rel.memory,
          research: rel.research,
          exploration: rel.exploration,
          selected: id === focus,
        };
      }),
    });
    this.refreshGame();
    this.paintEmblems();
  }

  private openSpies() {
    const game = this.game!;
    const me = game.state.playerFaction;
    const mine = game.state.spies.filter((spy) => spy.owner === me);
    const others = FACTION_IDS.filter((id) => id !== me);
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal" data-testid="spy-screen">
        <p class="eyebrow">Spy network</p>
        <h2>Embedded eyes</h2>
        <p class="muted">Recruiting costs ${CONFIG.spies.recruitCost} credits. There is no maintenance. A placed spy infiltrates that faction: their map, stocks, and research update live.</p>
        <button class="btn primary" data-action="recruit-spy" data-testid="recruit-spy">Recruit a spy</button>
        <button class="btn" data-action="sweep" data-testid="sweep">Counterintelligence sweep</button>
        ${mine.map((spy) => {
          const intel = spy.host ? game.intel(spy.host) : null;
          return `<section>
            <h3>Spy ${spy.id} ${spy.host ? `inside ${esc(FACTIONS[spy.host].name)}` : 'waiting'}</h3>
            ${spy.host ? '' : `<div class="row"><select data-spy-host="${spy.id}">${others.map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select><button class="btn small" data-action="place-spy" data-id="${spy.id}">Place</button></div>`}
            ${intel ? `<p>Credits ${intel.credits} · minerals ${intel.minerals} · nutrients ${intel.nutrients} · energy ${intel.energy} · research ${intel.researchPoints}${intel.researching ? ` toward ${esc(techById(intel.researching)?.name ?? intel.researching)}` : ''}</p><p class="muted">Known: ${esc(intel.techs.join(', '))}</p>` : ''}
            ${spy.host ? `<div class="stack">
              ${intel?.techs.filter((tech) => !game.state.factions[me].techs.includes(tech)).map((tech) => `<button class="btn small" data-action="steal-tech" data-id="${spy.id}" data-tech="${tech}">Steal ${esc(techById(tech)?.name ?? tech)}</button>`).join('') || '<p class="muted">No unknown tech to steal.</p>'}
              <button class="btn small" data-action="sabotage" data-id="${spy.id}">Sabotage</button>
              <div class="row">
                <select data-frame="left">${others.filter((id) => id !== spy.host).map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select>
                <select data-frame="right">${others.filter((id) => id !== spy.host).map((id) => `<option value="${id}">${esc(FACTIONS[id].name)}</option>`).join('')}</select>
                <button class="btn small" data-action="frame" data-id="${spy.id}">Frame job</button>
              </div>
            </div>` : ''}
          </section>`;
        }).join('') || '<p>No spies yet.</p>'}
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
    this.refreshGame();
  }

  private openSocial() {
    const axes = this.game!.state.factions[this.game!.state.playerFaction].axes;
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal">
        <h2>Society</h2>
        <p class="muted">Switching an axis costs ${CONFIG.social.switchCost} credits and shakes stability for ${CONFIG.social.stabilityHitTurns} turns. Matching choices are worth +${Math.round(CONFIG.social.matchingBonus * 100)}%.</p>
        ${this.axisEditor(axes, 'switch-axis')}
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
  }

  private pickTech(id: string, action: string) {
    const game = this.game;
    if (!game) return;
    this.treeSelected = id;
    const faction = game.state.factions[game.state.playerFaction];
    const tech = techById(id);
    if (!tech || faction.techs.includes(id)) return;
    if (action === 'tech-goal' || !techAvailable(tech, faction.techs)) this.act(() => game.setResearchGoal(id), 'click');
    else this.act(() => game.chooseResearch(id), 'click');
  }

  private openTechTree() {
    const game = this.game;
    if (!game) return;
    const faction = game.state.factions[game.state.playerFaction];
    this.overlay.innerHTML = renderTechTree({
      points: faction.researchPoints,
      rate: game.ratesFor(game.state.playerFaction).research,
      known: faction.techs,
      researching: faction.researching,
      goal: faction.researchGoal,
      queue: faction.researchQueue ?? [],
      origins: faction.techOrigins ?? {},
      selected: this.treeSelected,
      notice: this.treeNotice,
      cam: this.treeCam,
    });
    if (!this.treeDidFit) {
      requestAnimationFrame(() => {
        if (!this.overlay.querySelector('[data-testid="tech-tree"]')) return;
        this.fitTree();
        this.treeDidFit = true;
      });
    }
  }

  private applyTreeCam() {
    const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]') as HTMLElement | null;
    if (!canvas) return;
    canvas.style.setProperty('--tree-zoom', String(this.treeCam.zoom));
    canvas.style.transform = `translate(${this.treeCam.x}px, ${this.treeCam.y}px) scale(${this.treeCam.zoom})`;
  }

  private fitTree() {
    const view = this.overlay.querySelector('[data-testid="tech-tree-viewport"]') as HTMLElement | null;
    const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]') as HTMLElement | null;
    if (!view || !canvas || canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;
    const zoom = Math.min(1, (view.clientWidth - 24) / canvas.offsetWidth, (view.clientHeight - 24) / canvas.offsetHeight);
    this.treeCam.zoom = Math.max(0.22, zoom);
    this.treeCam.x = 12;
    this.treeCam.y = 12;
    this.applyTreeCam();
  }

  private onTreeHover(event: Event) {
    const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]');
    if (!canvas) return;
    const node = (event.target as HTMLElement | null)?.closest?.('[data-tech]') as HTMLElement | null;
    canvas.classList.toggle('has-hover', !!node);
    canvas.querySelectorAll('.is-hover-chain').forEach((el) => el.classList.remove('is-hover-chain'));
    if (!node?.dataset.tech) return;
    const ids = new Set(
      [node.dataset.tech, node.dataset.ancestors ?? '', node.dataset.descendants ?? ''].join(',').split(',').filter(Boolean),
    );
    for (const id of ids) canvas.querySelector(`[data-tech="${CSS.escape(id)}"]`)?.classList.add('is-hover-chain');
    canvas.querySelectorAll('[data-edge]').forEach((edge) => {
      const from = edge.getAttribute('data-from');
      const to = edge.getAttribute('data-to');
      if (from && to && ids.has(from) && ids.has(to)) edge.classList.add('is-hover-chain');
    });
  }

  private onTreePointerDown(event: PointerEvent) {
    const viewport = (event.target as HTMLElement | null)?.closest?.('[data-testid="tech-tree-viewport"]');
    if (!viewport) return;
    if ((event.target as HTMLElement | null)?.closest?.('[data-tech]')) return;
    this.treeDrag = { x: event.clientX, y: event.clientY, panX: this.treeCam.x, panY: this.treeCam.y, pointer: event.pointerId };
  }

  private onTreePointerMove(event: PointerEvent) {
    if (!this.treeDrag || this.treeDrag.pointer !== event.pointerId) return;
    this.treeCam.x = this.treeDrag.panX + event.clientX - this.treeDrag.x;
    this.treeCam.y = this.treeDrag.panY + event.clientY - this.treeDrag.y;
    this.applyTreeCam();
  }

  private onTreePointerUp(event: PointerEvent) {
    if (this.treeDrag?.pointer === event.pointerId) this.treeDrag = null;
  }

  private onTreeWheel(event: WheelEvent) {
    if (!(event.target as HTMLElement | null)?.closest?.('[data-testid="tech-tree-viewport"]')) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    this.treeCam.zoom = Math.min(1.5, Math.max(0.22, this.treeCam.zoom * factor));
    this.applyTreeCam();
  }

  private maybePromptResearch(before: { techs: string[]; researching: string | null }) {
    const game = this.game;
    if (!game || game.state.winner || game.state.playerTurnsCompleted < 1) return;
    const faction = game.state.factions[game.state.playerFaction];
    const completed = before.researching && faction.techs.includes(before.researching) ? before.researching : null;
    if (completed) {
      const tech = techById(completed);
      const unlocks = tech?.unlocks.map((unlock) => unlock.name).join(', ') || 'the next step';
      this.treeNotice = `Research complete: ${tech?.name ?? completed} unlocks ${unlocks}`;
      this.treeSelected = completed;
      this.openTechTree();
      return;
    }
    const available = TECHS.some((tech) => tech.cost > 0 && techAvailable(tech, faction.techs));
    if (!faction.researching && available && !this.overlay.innerHTML) {
      this.treeNotice = 'Nothing is being researched. Choose a technology, or click a locked one to queue its prerequisites.';
      this.openTechTree();
    }
  }

  private openDesign() {
    const techs = this.game!.state.factions[this.game!.state.playerFaction].techs;
    const options = (parts: { id: string; name: string; req: string | null }[]) =>
      parts.filter((part) => partKnown(part.req, techs)).map((part) => `<option value="${part.id}">${esc(part.name)}</option>`).join('');
    const colors = FACTIONS[this.game!.state.playerFaction].colors;
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow">
        <h2>Design a unit</h2>
        <canvas id="design-preview" class="design-preview" data-unit-icon data-kind="infantry" data-color="${colors.main}" data-deep="${colors.deep}" width="296" height="208"></canvas>
        <label>Name <input id="design-name" value="Field design"/></label>
        <label>Chassis <select id="design-chassis">${options(CHASSIS)}</select></label>
        <label>Weapon <select id="design-weapon">${options(WEAPONS)}</select></label>
        <label>Armor <select id="design-armor">${options(ARMORS)}</select></label>
        <div class="stack">${SPECIALS.filter((part) => partKnown(part.req, techs)).map((part) => `<label><input type="checkbox" value="${part.id}" class="design-special"/> ${esc(part.name)}</label>`).join('')}</div>
        <button class="btn primary" data-action="save-design">Save design</button>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
    this.paintDesignPreview();
  }

  private paintDesignPreview() {
    const canvas = this.overlay.querySelector('#design-preview') as HTMLCanvasElement | null;
    const chassis = this.overlay.querySelector('#design-chassis') as HTMLSelectElement | null;
    if (!canvas || !chassis || !this.game) return;
    const colors = FACTIONS[this.game.state.playerFaction].colors;
    canvas.dataset.kind = unitKindFor({ chassis: chassis.value });
    canvas.dataset.color = colors.main;
    canvas.dataset.deep = colors.deep;
    paintUnitIcon(canvas);
  }

  private saveDesign() {
    const name = (this.overlay.querySelector('#design-name') as HTMLInputElement).value;
    const chassis = (this.overlay.querySelector('#design-chassis') as HTMLSelectElement).value;
    const weapon = (this.overlay.querySelector('#design-weapon') as HTMLSelectElement).value;
    const armor = (this.overlay.querySelector('#design-armor') as HTMLSelectElement).value;
    const specials = [...this.overlay.querySelectorAll('.design-special')].filter((box) => (box as HTMLInputElement).checked).map((box) => (box as HTMLInputElement).value);
    this.act(() => this.game!.createDesign({ name, chassis, weapon, armor, specials }), 'click');
    this.closeOverlay();
  }

  private openPause() {
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
        <label class="row" data-testid="autosave-toggle"><input type="checkbox" data-setting="autosave" ${autosave ? 'checked' : ''}/> Autosave every ${CONFIG.autosaveEveryTurns} turns</label>
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

  private openAudioPanel() {
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="audio-panel">
        <p class="eyebrow">Before the expedition</p>
        <h2>Audio</h2>
        ${renderAudioSettings(this.audio)}
        <button class="btn primary" data-action="close" data-testid="audio-close">Close</button>
      </div></div>`;
  }

  private askSaveFirst(mode: 'new' | 'exit') {
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

  private async openSave(purpose: string) {
    try {
      const list = await this.saves.list();
      this.overlay.innerHTML = `
        <div class="modal-back"><div class="modal narrow" data-testid="save-list">
          <h2>Save game</h2>
          <p class="muted">Nine manual slots. The autosave is separate and always listed first when you load.</p>
          <div class="stack">
            ${list.filter((slot) => slot.slot !== 0).map((slot) => `<button class="btn" data-action="save-slot" data-testid="save-slot-${slot.slot}" data-slot="${slot.slot}" data-purpose="${purpose}">Slot ${slot.slot}${slot.empty ? ' · empty' : ` · ${esc(slot.label ?? '')}`}${slot.corrupt ? ' · unreadable' : ''}</button>`).join('')}
          </div>
          <button class="btn" data-action="close">Cancel</button>
        </div></div>`;
    } catch (error) {
      this.showSaveError(purpose === 'then-exit' ? 'Could not open the save list, so Proxima stayed open.' : 'Could not open the save list.', error);
    }
  }

  private async openLoad(_fromGame: boolean) {
    try {
      const list = await this.saves.list();
      this.overlay.innerHTML = `
        <div class="modal-back"><div class="modal narrow">
          <h2>Load game</h2>
          <div class="stack" data-testid="load-list">
            ${list.map((slot) => `<button class="btn" data-action="load-slot" data-testid="load-slot-${slot.slot}" data-slot="${slot.slot}" ${slot.empty && !slot.corrupt ? 'disabled' : ''}>${slot.slot === 0 ? 'Autosave' : `Slot ${slot.slot}`}${slot.corrupt ? ' · unreadable' : slot.empty ? ' · empty' : ` · ${esc(slot.label ?? '')}`}</button>`).join('')}
          </div>
          <button class="btn" data-action="close">Close</button>
        </div></div>`;
    } catch (error) {
      this.showSaveError('Could not open the save list.', error);
    }
  }

  private async writeSlot(slot: number, purpose: string) {
    if (!this.game) return;
    try {
      const envelope = this.envelope(slot);
      await this.saves.write(slot, envelope);
      this.audio.play('save');
      this.toast(slot === 0 ? 'Autosaved.' : `Saved to slot ${slot}.`);
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

  private async readSlot(slot: number) {
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

  private async finishPending(saved: boolean) {
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

  private async exitDesktop() {
    if (window.proxima?.quit) await window.proxima.quit();
    else {
      this.screen = 'menu';
      this.game = null;
      this.render();
      window.close();
    }
  }

  private envelope(slot: number): SaveEnvelope {
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

  private exitIntro() {
    this.screen = 'menu';
    this.render();
  }

  private onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.screen === 'game') {
        if (this.game?.state.winner || this.game?.state.playerDefeated) return;
        if (this.game?.state.events.prompt && this.overlay.querySelector('[data-testid="event-popup"]')) return;
        if (this.overlay.innerHTML) this.closeOverlay();
        else this.openPause();
      } else if (this.overlay.querySelector('[data-testid="audio-panel"]')) this.closeOverlay();
      return;
    }
    const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.screen !== 'game' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      if (this.overlay.querySelector('[data-testid="tech-tree"]')) this.closeOverlay();
      else if (!this.overlay.innerHTML) this.openTechTree();
      return;
    }
    if (event.key.toLowerCase() === 'i' && this.map?.hover && !this.overlay.innerHTML) {
      event.preventDefault();
      this.openTile(this.map.hover.x, this.map.hover.y);
      return;
    }
    if (event.key.toLowerCase() !== 'm') return;
    event.preventDefault();
    this.audio.toggleMuted();
    this.syncSoundscape();
    this.syncMuteControls();
    this.toast(this.audio.muted ? 'Muted.' : 'Sound restored.');
  }

  /** Menu theme, intro cue, or the exploration playlist. The ambient bed plays only in a game. */
  private syncSoundscape() {
    if (this.screen === 'game') this.audio.startAmbient();
    else this.audio.stopAmbient();
    const scene = this.screen === 'intro' ? 'intro' : this.screen === 'game' ? 'game' : 'menu';
    this.audio.setScene(scene);
  }

  private syncMuteControls() {
    this.overlay.querySelectorAll<HTMLInputElement>('[data-setting="mute"]').forEach((box) => {
      box.checked = this.audio.muted;
    });
  }

  private applyAudioSettings(event: Event): boolean {
    if (!handleAudioSettings(this.audio, event)) return false;
    this.syncSoundscape();
    return true;
  }

  private closeOverlay() {
    if (this.overlay.querySelector('[data-testid="tech-tree"]')) this.treeNotice = '';
    this.overlay.innerHTML = '';
    this.treeDrag = null;
  }

  private openVictory() {
    const game = this.game!;
    const names = game.state.winner?.factions.map((id) => FACTIONS[id].name).join(', ');
    this.overlay.innerHTML = `
      <div class="modal-back" data-testid="victory-dialog"><div class="modal narrow">
        <h2>${game.state.winner?.factions.includes(game.state.playerFaction) ? 'Victory' : 'Defeat'}</h2>
        <p>${esc(names ?? '')} ${game.state.winner?.kind === 'alliance' ? 'share the victory.' : 'holds every city.'}</p>
        <button class="btn primary" data-action="view-recap" data-testid="view-recap">Social recap</button>
        <button class="btn" data-action="back-menu" data-testid="end-main-menu">Main menu</button>
      </div></div>`;
  }

  private prose(text: string) {
    return text.split(/\n\n/).map((part) => `<p>${esc(part)}</p>`).join('');
  }

  private societySummary(axes: Record<SocialAxis, string>) {
    return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[])
      .map((axis) => SOCIAL_OPTIONS[axis].find((option) => option.id === axes[axis])?.label ?? axes[axis])
      .join(' · ');
  }

  private customizePanel() {
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
      ${this.axisEditor(this.setup.axes, 'setup-axis')}
      <p class="muted">Personality is how this faction acts when the AI plays it. Game Options on the start menu edits every rival the same way.</p>
      <div class="stack" data-testid="personality-editor">
        ${traits.map((trait) => `<label class="personality-row"><span class="muted">${labels[trait]}</span><select data-personality="${id}" data-trait="${trait}">${PERSONALITY_LEVELS[trait].map((level) => `<option value="${level.id}" ${personality[trait] === level.id ? 'selected' : ''}>${esc(level.label)}</option>`).join('')}</select></label>`).join('')}
      </div>
    </div>`;
  }

  private openDefeat() {
    this.overlay.innerHTML = `
      <div class="modal-back" data-testid="defeat-screen"><div class="modal narrow">
        <p class="eyebrow">The band goes on without you</p>
        <h2>Defeat</h2>
        <p>${esc(FACTIONS[this.game!.state.playerFaction].name)} has no cities left, and no colony pod that can found another.</p>
        <div class="stack">
          <button class="btn primary" data-action="view-recap" data-testid="view-recap">Social recap</button>
          <button class="btn" data-action="back-menu" data-testid="defeat-menu">Main menu</button>
        </div>
      </div></div>`;
  }

  private openEvent() {
    const prompt = this.game?.state.events.prompt;
    if (!prompt) return;
    this.overlay.innerHTML = `
      <div class="modal-back" data-testid="event-popup"><div class="modal narrow">
        <p class="eyebrow">Random event</p>
        <h2>${esc(prompt.kind.replace('-', ' '))}</h2>
        <p>${esc(prompt.text)}</p>
        <div class="stack">
          ${prompt.choices.map((choice) => `<button class="btn" data-action="event-choice" data-choice="${choice.id}" data-testid="event-${choice.id}">${esc(choice.label)}</button>`).join('')}
        </div>
      </div></div>`;
  }

  private openTrade(target: FactionId) {
    const game = this.game!;
    const me = game.state.factions[game.state.playerFaction];
    const them = game.state.factions[target];
    const mine = me.techs.filter((tech) => !them.techs.includes(tech));
    const theirs = them.techs.filter((tech) => !me.techs.includes(tech));
    const techOptions = (ids: string[]) => `<option value="">No technology</option>${ids.map((id) => `<option value="${id}">${esc(techById(id)?.name ?? id)}</option>`).join('')}`;
    this.overlay.innerHTML = `
      <div class="modal-back" data-testid="trade-modal"><div class="modal narrow">
        <h2>Trade with ${esc(FACTIONS[target].name)}</h2>
        <p class="muted">You have ${me.credits} credits, ${me.minerals} minerals, ${me.nutrients} nutrients, ${me.energy} energy. They have ${them.credits} credits, ${them.minerals} minerals, ${them.nutrients} nutrients, ${them.energy} energy.</p>
        <label>You give <select id="trade-give" data-testid="trade-give"><option value="minerals">Minerals</option><option value="nutrients">Nutrients</option><option value="energy">Energy</option><option value="credits">Credits</option></select> <input id="trade-give-amount" type="number" min="0" value="8"/></label>
        <label>You ask <select id="trade-want"><option value="energy">Energy</option><option value="minerals">Minerals</option><option value="nutrients">Nutrients</option><option value="credits">Credits</option></select> <input id="trade-want-amount" type="number" min="0" value="6"/></label>
        <label>Technology you give <select id="trade-give-tech">${techOptions(mine)}</select></label>
        <label>Technology you ask <select id="trade-want-tech">${techOptions(theirs)}</select></label>
        <div class="row">
          <button class="btn primary" data-action="send-trade" data-target="${target}" data-testid="send-trade">Send offer</button>
          <button class="btn" data-action="open-diplomacy">Back</button>
        </div>
      </div></div>`;
  }

  private sendTrade(target: FactionId) {
    const game = this.game;
    if (!game) return;
    const giveKind = (document.querySelector('#trade-give') as HTMLSelectElement | null)?.value ?? 'minerals';
    const wantKind = (document.querySelector('#trade-want') as HTMLSelectElement | null)?.value ?? 'energy';
    const giveAmount = Number((document.querySelector('#trade-give-amount') as HTMLInputElement | null)?.value) || 0;
    const wantAmount = Number((document.querySelector('#trade-want-amount') as HTMLInputElement | null)?.value) || 0;
    const giveTech = (document.querySelector('#trade-give-tech') as HTMLSelectElement | null)?.value || null;
    const wantTech = (document.querySelector('#trade-want-tech') as HTMLSelectElement | null)?.value || null;
    const blank = (): TradeBundle => ({ credits: 0, minerals: 0, nutrients: 0, energy: 0, tech: null });
    const give = blank();
    const want = blank();
    if (giveKind === 'credits' || giveKind === 'minerals' || giveKind === 'nutrients' || giveKind === 'energy') give[giveKind] = giveAmount;
    if (wantKind === 'credits' || wantKind === 'minerals' || wantKind === 'nutrients' || wantKind === 'energy') want[wantKind] = wantAmount;
    give.tech = giveTech;
    want.tech = wantTech;
    const result = game.proposeTrade(target, give, want);
    this.toast(result.message);
    if (result.ok) this.openDiplomacy();
  }

  private debugDefeat() {
    const game = this.game;
    if (!game) return;
    const player = game.state.playerFaction;
    game.state.cities = game.state.cities.filter((city) => city.factionId !== player);
    game.state.units = game.state.units.filter((unit) => unit.factionId !== player);
    game.state.playerDefeated = true;
    this.overlay.innerHTML = '';
    this.refreshGame();
  }

  private debugTrade() {
    const game = this.game;
    if (!game) return;
    const from = FACTION_IDS.find((id) => id !== game.state.playerFaction) ?? 'verdantia';
    game.state.offers.push({
      id: game.state.nextOfferId++,
      from,
      to: game.state.playerFaction,
      kind: 'trade',
      trade: {
        give: { credits: 0, minerals: 12, nutrients: 0, energy: 0, tech: null },
        want: { credits: 0, minerals: 0, nutrients: 0, energy: 8, tech: null },
      },
    });
    this.openDiplomacy();
  }

  private debugEvent() {
    const game = this.game;
    if (!game) return;
    game.state.events.prompt = eventPromptFor('solar-flare', game.state.events.nextId++);
    this.overlay.innerHTML = '';
    this.openEvent();
  }

  private debugTransport() {
    const game = this.game;
    if (!game) return;
    const player = game.state.playerFaction;
    const passenger = game.unitsOf(player).find((unit) => unit.domain === 'land' && unit.aboard == null);
    if (!passenger) return;
    let coast: { x: number; y: number; sx: number; sy: number } | null = null;
    for (let y = 0; y < game.state.height && !coast; y++) {
      for (let x = 0; x < game.state.width && !coast; x++) {
        if (isSea(game.tile(x, y).terrain)) continue;
        for (let dy = -1; dy <= 1 && !coast; dy++) {
          for (let dx = -1; dx <= 1 && !coast; dx++) {
            if (!dx && !dy) continue;
            const sx = x + dx;
            const sy = y + dy;
            if (!game.inBounds(sx, sy) || !isSea(game.tile(sx, sy).terrain)) continue;
            if (game.state.units.some((unit) => unit.x === sx && unit.y === sy && unit.aboard == null)) continue;
            coast = { x, y, sx, sy };
          }
        }
      }
    }
    if (!coast) return;
    passenger.x = coast.x;
    passenger.y = coast.y;
    passenger.aboard = null;
    const design = starterDesigns().find((entry) => entry.transport > 0)!;
    const ship: Unit = {
      id: game.state.nextUnitId++,
      factionId: player,
      designId: design.id,
      name: design.name,
      x: coast.sx,
      y: coast.sy,
      hp: design.hp,
      maxHp: design.hp,
      movesLeft: design.moves,
      maxMoves: design.moves,
      attack: design.attack,
      defense: design.defense,
      vision: design.vision,
      domain: design.domain,
      canFound: false,
      canTerraform: false,
      searchBonus: 0,
      role: design.role,
      searching: false,
      terraform: null,
      transport: design.transport,
      cargo: [],
      aboard: null,
    };
    game.state.units.push(ship);
    game.state.whoseTurn = player;
    game.loadUnit(ship.id, passenger.id);
    this.selectedUnit = ship.id;
    this.overlay.innerHTML = '';
    this.refreshGame();
  }

  private debugFinishTerraform(): { x: number; y: number } | null {
    const game = this.game;
    if (!game) return null;
    const unit = game.state.units.find((entry) => entry.factionId === game.state.playerFaction && entry.terraform);
    if (!unit) return null;
    game.advanceTerraform(unit.id);
    this.focusTile = { x: unit.x, y: unit.y };
    this.preferTile = true;
    this.refreshGame();
    return { x: unit.x, y: unit.y };
  }

  private debugMidgame() {
    const game = this.game;
    if (!game) return;
    const rivals = FACTION_IDS.filter((id) => id !== game.state.playerFaction);
    for (const id of rivals) {
      let added = 0;
      for (let y = 3; y < game.state.height - 2 && added < 2; y += 6) {
        const x = CONFIG.map.bandStart + ((y + added * 3) % (CONFIG.map.bandEnd - CONFIG.map.bandStart + 1));
        const tile = game.tile(x, y);
        if (isSea(tile.terrain) || tile.scarred) continue;
        const tooClose = game.state.cities.some(
          (city) => Math.max(Math.abs(city.x - x), Math.abs(city.y - y)) < CONFIG.city.minDistance,
        );
        if (tooClose) continue;
        tile.livable = true;
        tile.zone = 'twilight';
        game.state.cities.push({
          id: game.state.nextCityId++,
          name: `${FACTIONS[id].name} Outpost ${added + 1}`,
          factionId: id,
          x,
          y,
          population: 3,
          nutrientStore: 6,
          starveTurns: 0,
          defenseHp: CONFIG.city.militiaHp,
          production: null,
        });
        added++;
      }
    }
    game.state.explored[game.state.playerFaction].fill(true);
    this.overlay.innerHTML = '';
    this.map?.centerOn(Math.floor((CONFIG.map.bandStart + CONFIG.map.bandEnd) / 2), Math.floor(game.state.height / 2));
    this.refreshGame();
  }

  private factionButton(id: FactionId) {
    const faction = FACTIONS[id];
    const leader = LEADERS[id];
    return `<button class="faction-card ${this.setup.faction === id ? 'on' : ''}" data-action="pick-faction" data-faction="${id}" data-testid="faction-${id}"><canvas data-portrait="${id}" width="144" height="144"></canvas><canvas data-emblem="${id}" width="56" height="56"></canvas><span><strong>${esc(faction.name)}</strong><br/><span class="muted">${esc(leader.name)}</span></span></button>`;
  }

  private axisEditor(axes: Record<SocialAxis, string>, action: string) {
    return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[]).map((axis) => `
      <div>
        <p class="muted">${esc(axis)}</p>
        <div class="row">
          ${SOCIAL_OPTIONS[axis].map((option) => `<button class="choice ${axes[axis] === option.id ? 'on' : ''}" data-action="${action}" data-axis="${axis}" data-option="${option.id}">${esc(option.label)}</button>`).join('')}
        </div>
      </div>`).join('');
  }

  private axisCompare(start: Record<SocialAxis, string>, end: Record<SocialAxis, string>) {
    return (Object.keys(SOCIAL_OPTIONS) as SocialAxis[]).map((axis) => {
      const from = SOCIAL_OPTIONS[axis].find((option) => option.id === start[axis])?.label ?? start[axis];
      const to = SOCIAL_OPTIONS[axis].find((option) => option.id === end[axis])?.label ?? end[axis];
      return `<p><strong>${esc(axis)}</strong> ${esc(from)}${from === to ? ' held.' : ` became ${esc(to)}.`}</p>`;
    }).join('');
  }

  private paintEmblems() {
    for (const root of [this.stage, this.overlay]) this.paintMarks(root);
  }

  private paintMarks(root: ParentNode) {
    root.querySelectorAll('canvas[data-emblem]').forEach((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawEmblem(ctx, canvas.dataset.emblem as FactionId, canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4);
    });
    root.querySelectorAll('canvas[data-portrait]').forEach((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      const faction = canvas.dataset.portrait as FactionId | undefined;
      if (!ctx || !faction) return;
      drawPortrait(ctx, faction, canvas.width, canvas.height);
    });
    root.querySelectorAll('canvas[data-unit-icon]').forEach((node) => paintUnitIcon(node as HTMLCanvasElement));
    root.querySelectorAll('canvas[data-ark]').forEach((node) => paintArkCanvas(node as HTMLCanvasElement));
  }

  private showPortraitSheet() {
    this.stopMotion();
    this.overlay.innerHTML = '';
    this.screen = 'menu';
    this.stage.innerHTML = `
      <div class="portrait-sheet" id="portrait-sheet" data-testid="portrait-sheet">
        ${FACTION_IDS.map((id) => {
          const leader = LEADERS[id];
          return `<figure>
            <canvas data-portrait="${id}" width="480" height="480"></canvas>
            <figcaption><strong>${esc(leader.name)}</strong><span>${esc(leader.title)}</span><em>${esc(FACTIONS[id].name)}</em></figcaption>
          </figure>`;
        }).join('')}
      </div>`;
    this.paintEmblems();
  }

  private showUnitSheet() {
    this.stopMotion();
    this.overlay.innerHTML = '';
    this.screen = 'menu';
    this.stage.innerHTML = unitContactSheetMarkup();
    this.paintEmblems();
  }

  private seedDiplomacyOffer() {
    const game = this.game;
    if (!game) return null;
    const from = FACTION_IDS.find((id) => id !== game.state.playerFaction) ?? 'verdantia';
    const offer: DiplomaticOffer = {
      id: game.state.nextOfferId++,
      from,
      to: game.state.playerFaction,
      kind: 'nap',
    };
    game.state.offers.push(offer);
    this.diplomacyFocus = from;
    this.openDiplomacy();
    return offer.id;
  }

  private adjacentFoe(unit: Unit): { x: number; y: number; name: string } | null {
    const game = this.game!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const preview = game.previewAttack(unit.id, unit.x + dx, unit.y + dy);
        if (preview.ok) return { x: unit.x + dx, y: unit.y + dy, name: preview.defenderName };
      }
    }
    return null;
  }

  private spawnRaider(): { x: number; y: number; name: string } | null {
    const game = this.game;
    if (!game) return null;
    const scout = game.unitsOf(game.state.playerFaction).find((unit) => unit.attack > 0);
    if (!scout) return null;
    const design = starterDesigns().find((entry) => entry.role === 'military')!;
    const foe = FACTION_IDS.find((id) => id !== game.state.playerFaction)!;
    const x = Math.min(game.state.width - 1, scout.x + 1);
    const y = scout.y;
    const tile = game.tile(x, y);
    tile.terrain = 'grass';
    tile.zone = 'twilight';
    tile.livable = true;
    tile.scarred = false;
    const unit: Unit = {
      id: game.state.nextUnitId++,
      factionId: foe,
      designId: design.id,
      name: 'Raider',
      x,
      y,
      hp: design.hp,
      maxHp: design.hp,
      movesLeft: 0,
      maxMoves: design.moves,
      attack: design.attack,
      defense: design.defense,
      vision: design.vision,
      domain: design.domain,
      canFound: false,
      canTerraform: false,
      searchBonus: 0,
      role: 'military',
      searching: false,
      terraform: null,
      transport: 0,
      cargo: [],
      aboard: null,
    };
    game.state.units.push(unit);
    game.relation(game.state.playerFaction, foe).stance = 'war';
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (game.inBounds(x + dx, y + dy)) game.state.explored[game.state.playerFaction][(y + dy) * game.state.width + (x + dx)] = true;
      }
    }
    this.selectedUnit = scout.id;
    this.selectedCity = null;
    this.preferTile = false;
    this.refreshGame();
    return { x, y, name: unit.name };
  }

  private debugRecap() {
    const game = this.game;
    if (!game) return;
    if (game.state.axisHistory.length < 2) {
      const current = game.state.factions[game.state.playerFaction].axes;
      game.state.axisHistory.push({ round: Math.max(2, game.state.round), axes: { ...current, values: 'curiosity' } });
    }
    game.state.winner = { kind: 'solo', factions: [game.state.playerFaction] };
    this.overlay.innerHTML = '';
    this.screen = 'recap';
    this.render();
  }

  private async runSave(work: () => Promise<void>, fallback: string) {
    try {
      await work();
    } catch (error) {
      this.showSaveError(fallback, error);
    }
  }

  private showSaveError(message: string, error?: unknown) {
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

  private paintBanner() {
    const host = document.querySelector('#update-banner');
    if (!host) return;
    host.innerHTML = !this.updateDismissed && this.updateNotice?.status === 'available' ? renderUpdateBanner(this.updateNotice) : '';
  }

  private async bootUpdates() {
    try {
      const settings = await this.platform.getSettings();
      this.updateCheck = settings.updateCheck;
      if (this.platform.kind === 'desktop' && !settings.updatePromptSeen && this.screen === 'menu') {
        this.overlay.innerHTML = renderUpdatePrompt();
        return;
      }
      if (settings.updateCheck) await this.pollUpdates();
    } catch (error) {
      void this.platform.reportError(error instanceof Error ? (error.stack || error.message) : String(error));
    }
  }

  private async persistUpdateCheck(enabled: boolean) {
    try {
      await this.platform.setUpdateCheck(enabled);
      if (enabled) await this.pollUpdates();
      else {
        this.updateNotice = null;
        this.paintBanner();
      }
    } catch (error) {
      this.toast('Could not store the update setting.');
      void this.platform.reportError(error instanceof Error ? error.message : String(error));
    }
  }

  private async pollUpdates() {
    const result = await this.platform.checkForUpdates();
    if (result.status !== 'available' || this.updateDismissed) return;
    this.updateNotice = result;
    this.paintBanner();
  }

  private async handleUpdateAction(action: string | undefined, node: HTMLElement) {
    if (action === 'update-dismiss') {
      this.updateDismissed = true;
      this.paintBanner();
      return true;
    }
    if (action === 'update-skip') {
      const version = this.updateNotice?.version;
      this.updateDismissed = true;
      this.updateNotice = null;
      this.paintBanner();
      if (version) {
        try { await this.platform.skipVersion(version); } catch { /* logged in the desktop app */ }
      }
      return true;
    }
    if (action === 'update-open') {
      const url = node.dataset.url || this.updateNotice?.url || '';
      const opened = await this.platform.openReleasePage(url);
      if (!opened) this.toast('That page is not a Proxima release.');
      return true;
    }
    if (action === 'update-download') {
      await this.openDownloadConsent();
      return true;
    }
    if (action === 'update-download-cancel') {
      await this.platform.cancelDownload();
      this.closeOverlay();
      return true;
    }
    if (action === 'update-download-confirm') {
      await this.runDownload();
      return true;
    }
    if (action === 'update-show-folder') {
      await this.platform.showInFolder(node.dataset.file || '');
      return true;
    }
    if (action === 'update-prompt-yes') {
      await this.answerUpdatePrompt(true);
      return true;
    }
    if (action === 'update-prompt-no') {
      await this.answerUpdatePrompt(false);
      return true;
    }
    return false;
  }

  private async answerUpdatePrompt(enable: boolean) {
    this.updateCheck = enable;
    try {
      await this.platform.answerUpdatePrompt(enable);
    } catch (error) {
      this.toast('Could not store that choice.');
      void this.platform.reportError(error instanceof Error ? error.message : String(error));
    }
    this.closeOverlay();
    if (this.screen === 'menu') this.render();
    if (enable) await this.pollUpdates();
  }

  private async openDownloadConsent() {
    try {
      const offer = await this.platform.prepareDownload();
      if (!offer) {
        this.toast('No installer is listed for this release.');
        return;
      }
      this.overlay.innerHTML = renderDownloadConsent(offer);
    } catch (error) {
      this.toast('Could not prepare the download.');
      void this.platform.reportError(error instanceof Error ? error.message : String(error));
    }
  }

  private async runDownload() {
    const fileName = this.overlay.querySelector('[data-testid="download-name"]')?.textContent ?? 'Installer';
    this.overlay.innerHTML = renderDownloadProgress(fileName.replace(/^File\s*/, ''));
    const stop = this.platform.onDownloadProgress((progress) => {
      const node = this.overlay.querySelector('[data-testid="download-progress"]');
      if (node) node.textContent = progress.total > 0 ? `${progress.percent}%` : `${progress.received} bytes`;
    });
    try {
      const result = await this.platform.downloadUpdate();
      if (!result.ok || !result.file) {
        this.overlay.innerHTML = renderDownloadFailed(result.message || 'The download did not finish.');
        return;
      }
      this.overlay.innerHTML = renderDownloadDone(result.file, Boolean(result.verifiedSha256));
    } catch (error) {
      this.overlay.innerHTML = renderDownloadFailed(error instanceof Error ? error.message : 'The download did not finish.');
    } finally {
      stop();
    }
  }

  private previewUpdate() {
    this.updateDismissed = false;
    this.updateNotice = {
      status: 'available',
      version: '0.3.0',
      notes: 'Save files from 0.1.0 load in this build.\nProxima can tell you when a newer version is published.\nNothing is downloaded until you ask.',
      url: 'https://github.com/jasonvgriffin/proxima/releases/tag/v0.3.0',
    };
    this.paintBanner();
  }

  private previewDownloadConsent() {
    this.overlay.innerHTML = renderDownloadConsent({
      fileName: 'Proxima-Setup-0.3.0.exe',
      size: 86_016_000,
      destination: 'C:\\Users\\Jason\\Downloads\\Proxima-Setup-0.3.0.exe',
    });
  }

  private toast(message: string) {
    const node = document.querySelector('#toast') as HTMLElement | null;
    if (!node) return;
    node.hidden = false;
    node.textContent = message;
    window.setTimeout(() => {
      node.hidden = true;
    }, 2200);
  }
}

const VOLUME_KEYS = ['master', 'music', 'sfx', 'ambient'] as const;

/** The music, effects, ambient, and mute controls shared by the start menu and the pause menu. */
function renderAudioSettings(audio: AudioBus): string {
  const sliders = VOLUME_KEYS.map((key) => {
    const value = audio[key];
    return `<label class="slider">${key} <input type="range" min="0" max="1" step="0.01" value="${value}" data-volume="${key}" data-testid="audio-volume-${key}"/><b>${Math.round(value * 100)}</b></label>`;
  }).join('');
  return `
    <div class="audio-settings" data-testid="audio-settings">
      <label class="row"><input type="checkbox" data-setting="mute" data-testid="audio-mute" ${audio.muted ? 'checked' : ''}/> Mute all</label>
      <p class="muted audio-note">Mute all silences music, effects, and ambient, then restores these same levels. Press M in a game. Ambient is a low wind and reactor hum during play, and it rests on the menu and the recap.</p>
      <label class="row"><input type="checkbox" data-setting="music" data-testid="audio-music" ${audio.musicOn ? 'checked' : ''}/> Music</label>
      <label class="row"><input type="checkbox" data-setting="sfx" data-testid="audio-sfx" ${audio.sfxOn ? 'checked' : ''}/> Sound effects</label>
      ${sliders}
      <label class="row">Track <select data-setting="track" data-testid="audio-track">${TRACKS.map((track) => `<option value="${track.id}" ${audio.track === track.id ? 'selected' : ''}>${esc(track.name)}</option>`).join('')}</select></label>
      <label class="row">Order <select data-setting="mode" data-testid="audio-mode"><option value="loop" ${audio.mode === 'loop' ? 'selected' : ''}>Loop</option><option value="shuffle" ${audio.mode === 'shuffle' ? 'selected' : ''}>Shuffle</option></select></label>
      <p class="muted audio-note" data-testid="music-credits">Music: <a href="https://opengameart.org/content/dark-sci-fi-audio-pack" target="_blank" rel="noopener noreferrer">SRG774</a>, <a href="https://opengameart.org/content/exploration-theme" target="_blank" rel="noopener noreferrer">Cleyton Kauffman</a>, <a href="https://opengameart.org/content/outworld" target="_blank" rel="noopener noreferrer">vitalezzz</a> (CC0, <a href="https://opengameart.org/" target="_blank" rel="noopener noreferrer">OpenGameArt</a>)</p>
    </div>`;
}

/** One handler for both menus. Returns true when the event belonged to these controls. */
function handleAudioSettings(audio: AudioBus, event: Event): boolean {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return false;
  if (event.type === 'input' && target instanceof HTMLInputElement) {
    const key = target.dataset.volume;
    if (key !== 'master' && key !== 'music' && key !== 'sfx' && key !== 'ambient') return false;
    audio.setVolume(key, Number(target.value));
    const label = target.parentElement?.querySelector('b');
    if (label) label.textContent = String(Math.round(audio[key] * 100));
    return true;
  }
  if (event.type !== 'change') return false;
  const setting = target.dataset.setting;
  if (setting === 'mute' && target instanceof HTMLInputElement) {
    audio.setMuted(target.checked);
    return true;
  }
  if (setting === 'music' && target instanceof HTMLInputElement) {
    audio.setMusic(target.checked);
    return true;
  }
  if (setting === 'sfx' && target instanceof HTMLInputElement) {
    audio.setSfx(target.checked);
    return true;
  }
  if (setting === 'mode' && target instanceof HTMLSelectElement) {
    audio.setMode(target.value === 'shuffle' ? 'shuffle' : 'loop');
    return true;
  }
  if (setting === 'track' && target instanceof HTMLSelectElement) {
    audio.setTrack(target.value);
    return true;
  }
  return false;
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export interface DiplomacyFactionRow {
  id: FactionId;
  name: string;
  leader: string;
  stance: Stance;
  memory: number;
  research: boolean;
  exploration: boolean;
  selected: boolean;
}

export interface DiplomacyMarkup {
  offers: { id: number; from: FactionId; fromName: string; kind: Proposal | 'trade'; label: string }[];
  focus: { factionId: FactionId; factionName: string; leader: string; title: string; greeting: string };
  factions: DiplomacyFactionRow[];
}

const DIPLOMACY_ACTIONS: [string, string][] = [
  ['war', 'Declare war'],
  ['peace', 'Offer peace'],
  ['nap', 'Non-aggression'],
  ['alliance', 'Alliance'],
  ['research', 'Research treaty'],
  ['exploration', 'Share maps'],
];

export function diplomacyMarkup(view: DiplomacyMarkup): string {
  const offers = view.offers
    .map(
      (offer) => `<p class="offer-line" data-testid="${offer.kind === 'trade' ? 'trade-offer' : 'diplomacy-offer'}">
        <canvas data-emblem="${offer.from}" width="64" height="64"></canvas>
        <span>${esc(offer.fromName)} offers ${esc(offer.label)}.</span>
        <button class="btn small" data-action="accept-offer" data-id="${offer.id}">Accept</button>
        <button class="btn small" data-action="reject-offer" data-id="${offer.id}">Reject</button>
      </p>`,
    )
    .join('');
  const rows = view.factions
    .map((row) => {
      const standing = row.stance === 'nap' ? 'non-aggression pact' : row.stance;
      return `<section class="diplomacy-faction ${row.selected ? 'on' : ''}" data-testid="diplomacy-row" data-faction="${row.id}">
        <button class="diplomacy-head ${row.selected ? 'on' : ''}" data-action="select-diplomat" data-faction="${row.id}" data-testid="diplomat-${row.id}">
          <canvas data-portrait="${row.id}" width="112" height="144"></canvas>
          <canvas data-emblem="${row.id}" width="64" height="64"></canvas>
          <span><h3>${esc(row.name)}</h3><p class="muted">${esc(row.leader)}</p></span>
        </button>
        <p class="muted">Standing: ${esc(standing)}. Grievance ${row.memory}. Research treaty ${row.research ? 'yes' : 'no'}. Exploration treaty ${row.exploration ? 'yes' : 'no'}.</p>
        <div class="row">
          ${DIPLOMACY_ACTIONS.map(([kind, label]) => `<button class="btn small" data-action="propose" data-target="${row.id}" data-kind="${kind}">${esc(label)}</button>`).join('')}
          <button class="btn small" data-action="open-trade" data-target="${row.id}" data-testid="trade-${row.id}">Trade</button>
        </div>
      </section>`;
    })
    .join('');
  const focus = view.focus;
  return `<div class="modal-back"><div class="modal diplomacy-modal" data-testid="diplomacy-screen">
    <p class="eyebrow">Diplomacy</p>
    <h2>The ladder</h2>
    <p class="muted">War, then peace, then a non-aggression pact, then an alliance. Research and exploration treaties can sit beside peace or above. No unit has to make contact first.</p>
    ${offers}
    <div class="diplomacy-layout">
      <aside class="diplomat" data-testid="diplomat-panel">
        <div class="diplomat-art">
          <canvas data-portrait="${focus.factionId}" width="440" height="572"></canvas>
          <canvas class="diplomat-crest" data-emblem="${focus.factionId}" width="96" height="96"></canvas>
        </div>
        <p class="eyebrow">${esc(focus.title)}</p>
        <h3>${esc(focus.leader)}</h3>
        <p class="muted">${esc(focus.factionName)}</p>
        <p data-testid="diplomat-greeting">${esc(focus.greeting)}</p>
      </aside>
      <div class="diplomacy-rows">${rows}</div>
    </div>
    <button class="btn" data-action="close">Close</button>
  </div></div>`;
}
