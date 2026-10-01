import { CONFIG } from '../config';
import { drawEmblem, drawPlanet, drawStar, drawStarfield } from '../art/draw';
import { AudioBus, TRACKS } from '../audio/engine';
import { playLoggedCues, playTerraformProgress, snapshotLog, snapshotTerraform } from '../audio/listen';
import { difficultyLabel, difficultyProfile, normalizeDifficulty, outsideBandDamage } from '../core/difficulty';
import { FACTIONS, SOCIAL_OPTIONS, defaultAxes, defaultPersonalities, DIFFICULTIES, PERSONALITY_LEVELS } from '../core/factions';
import { Game, PROJECTS, projectLabel } from '../core/game';
import { proposalLabel } from '../core/diplomacy';
import { biomeClass, formatCalendar, terraformFee, terraformTurns } from '../core/rules';
import { formerTechLevel, TECHS, techAvailable, techById } from '../core/tech';
import { starterDesigns, CHASSIS, WEAPONS, ARMORS, SPECIALS, partKnown } from '../core/parts';
import { FACTION_IDS, type Difficulty, type FactionId, type GameState, type Proposal, type SaveEnvelope, type SocialAxis, type Unit } from '../core/types';
import { createSaveStore, type SaveStore } from '../platform/saves';
import { IntroPlayer, INTRO_SCENES } from '../render/intro';
import { MapView } from '../render/mapview';

type Screen = 'menu' | 'intro' | 'setup' | 'options' | 'profile' | 'game' | 'recap';

export class App {
  private stage: HTMLElement;
  private overlay: HTMLElement;
  private audio = new AudioBus();
  private saves: SaveStore = createSaveStore();
  private screen: Screen = 'menu';
  private game: Game | null = null;
  private introIndex = 0;
  private introPlayer: IntroPlayer | null = null;
  private map: MapView | null = null;
  private gameMounted = false;
  private backdrop = 0;
  private selectedUnit: number | null = null;
  private selectedCity: number | null = null;
  private reach = new Set<string>();
  private profileId: FactionId = 'helm';
  private profileReturn: Screen = 'menu';
  private pending: { mode: 'new' | 'exit' } | null = null;
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
    root.innerHTML = '<div id="stage"></div><div id="overlay"></div><div id="toast" hidden></div>';
    this.stage = root.querySelector('#stage')!;
    this.overlay = root.querySelector('#overlay')!;
    root.addEventListener('click', (event) => this.onClick(event));
    root.addEventListener('change', (event) => this.onChange(event));
    root.addEventListener('input', (event) => this.onInput(event));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.screen === 'game') {
        if (this.overlay.innerHTML) this.closeOverlay();
        else this.openPause();
      }
    });
    root.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    if (import.meta.env.DEV) {
      window.__proximaDebug = {
        spawnRaider: () => this.spawnRaider(),
        showRecap: () => this.debugRecap(),
        state: () => this.game?.serialize() ?? null,
        tilePoint: (x: number, y: number) => this.map?.clientPoint(x, y) ?? null,
      };
    }
    this.render();
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
          <p class="tag">A single-player story of six factions on a tidally locked world. The twilight band is the only home, until someone changes that.</p>
          <div>
            <p class="muted">Difficulty</p>
            <div class="row" data-testid="difficulty">
              ${DIFFICULTIES.map((item) => `<button class="btn small ${this.setup.difficulty === item.id ? 'on' : ''}" data-action="difficulty" data-difficulty="${item.id}" data-testid="difficulty-${item.id}">${esc(item.label)}</button>`).join('')}
            </div>
            <p class="muted" data-testid="difficulty-blurb">${esc(difficultyProfile(this.setup.difficulty).blurb)}</p>
          </div>
          <label class="row"><input type="checkbox" data-setting="allied" ${this.setup.allied ? 'checked' : ''}/> Allied Victory</label>
          <label class="row"><input type="checkbox" data-setting="events" ${this.setup.events ? 'checked' : ''}/> Random events (saved, not fired in this build)</label>
          <div class="stack">
            <button class="btn primary" data-action="play-intro" data-testid="play-intro">Play Introduction</button>
            <button class="btn" data-action="new-game" data-testid="new-game">New Game</button>
            <button class="btn" data-action="load-game" data-testid="load-game">Load Game</button>
            <button class="btn" data-action="game-options" data-testid="game-options">Game Options</button>
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
            <p class="eyebrow">Introduction ${this.introIndex + 1} / 6</p>
            <h2>${esc(scene.title)}</h2>
            <p data-testid="intro-text">${esc(scene.text)}</p>
          </div>
          <div class="intro-actions">
            <button class="btn" data-action="intro-back" data-testid="intro-back" ${this.introIndex === 0 ? 'disabled' : ''}>Back</button>
            <button class="btn primary" data-action="intro-next" data-testid="intro-next">${this.introIndex === 5 ? 'Finish' : 'Next'}</button>
            <button class="btn" data-action="intro-exit" data-testid="intro-exit">Exit</button>
          </div>
        </div>
      </div>`;
    this.introPlayer = new IntroPlayer(this.stage.querySelector('#intro-canvas') as HTMLCanvasElement, () => this.introIndex);
  }

  private renderSetup() {
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
        <div class="sheet-card">
          <h2>${esc(FACTIONS[this.setup.faction].name)}</h2>
          <p class="tag">${esc(FACTIONS[this.setup.faction].idea)}</p>
          <p class="muted">Social axes start on this faction's strengths. Each match is +10%. Changing one later costs ${CONFIG.social.switchCost} credits.</p>
          ${this.axisEditor(this.setup.axes, 'setup-axis')}
          <button class="btn primary" data-action="start-game" data-testid="start-game">Begin in the twilight</button>
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
            <canvas data-emblem="${faction.id}" width="120" height="120"></canvas>
            <div>
              <p class="eyebrow">${esc(faction.formerly)}</p>
              <h2>${esc(faction.name)}</h2>
              <p>${esc(faction.backstory)}</p>
              <p class="muted">Look: ${esc(faction.visual)}</p>
              <p class="muted">Free starting tech: ${esc(faction.freeTechName)}.</p>
              <div class="bars" aria-hidden="true"><i style="background:${faction.colors.main}"></i><i style="background:${faction.colors.deep}"></i><i style="background:${faction.colors.ink}"></i></div>
            </div>
          </div>
          <button class="btn" data-action="profile-back" data-testid="profile-back">Back</button>
        </div>
      </div>`;
    this.paintEmblems();
  }

  private renderRecap() {
    const game = this.game;
    const id = game?.state.playerFaction ?? this.setup.faction;
    const faction = FACTIONS[id];
    const history = game?.state.axisHistory ?? [];
    const start = history[0];
    const end = history[history.length - 1];
    const winner = game?.state.winner;
    const won = winner?.factions.includes(id);
    this.stage.innerHTML = `
      <div class="sheet" data-testid="recap-screen">
        <div class="sheet-card" style="grid-column: 1 / -1; max-width: 820px">
          <p class="eyebrow">After the run</p>
          <h2>${esc(faction.name)}</h2>
          <p>${won ? 'Your faction holds the cities that remain.' : 'Another faction holds the cities that remain.'}</p>
          <p class="muted">${history.length < 2 ? 'The social axes never moved. The society you landed with is the one you kept.' : 'The axes drifted. What you believed at the crash is not what you believed at the end.'}</p>
          ${start && end ? this.axisCompare(start.axes, end.axes) : ''}
          <ol>${history.map((mark) => `<li>Week ${mark.round}: ${esc(Object.values(mark.axes).join(' · '))}</li>`).join('')}</ol>
          <button class="btn primary" data-action="back-menu" data-testid="recap-menu">Return to the start menu</button>
        </div>
      </div>`;
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
        (x, y) => this.onTile(x, y),
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
        <div class="chip"><span>Research</span><b>${research ? `${faction.researchPoints}/${research.cost}` : faction.researchPoints}</b></div>
        <div class="chip"><span>Credits</span><b>${faction.credits}</b></div>
      </div>
      <button class="btn small" data-action="open-diplomacy" data-testid="open-diplomacy">Diplomacy</button>
      <button class="btn small" data-action="open-spies" data-testid="open-spies">Spies</button>
      <button class="btn primary" data-action="end-turn" data-testid="end-turn">End Turn</button>`;
    const units = game.unitsOf(game.state.playerFaction);
    const cities = game.citiesOf(game.state.playerFaction);
    this.stage.querySelector('#left')!.innerHTML = `
      <h3>Forces</h3>
      <div data-testid="unit-list">
        ${units.map((unit) => `<button class="unit-btn ${unit.id === this.selectedUnit ? 'on' : ''}" data-action="select-unit" data-id="${unit.id}" data-testid="unit-${unit.id}" data-role="${unit.role}">${esc(unit.name)} · ${unit.hp}/${unit.maxHp} · ${unit.movesLeft} mp${unit.searching ? ' · search' : ''}${unit.terraform ? ' · working' : ''}</button>`).join('') || '<p class="muted">No units.</p>'}
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
  }

  private inspector(): string {
    const game = this.game!;
    const unit = this.selectedUnit != null ? game.unitById(this.selectedUnit) : undefined;
    const city = this.selectedCity != null ? game.state.cities.find((entry) => entry.id === this.selectedCity) : undefined;
    if (unit && unit.factionId === game.state.playerFaction) {
      const foe = this.adjacentFoe(unit);
      return `
        <h3>${esc(unit.name)}</h3>
        <p class="muted">${esc(unit.role)} · atk ${unit.attack} · def ${unit.defense} · move ${unit.movesLeft}/${unit.maxMoves}</p>
        <div class="stack">
          ${unit.canFound ? `<button class="btn primary" data-action="found-city" data-testid="found-city">Found city</button>` : ''}
          ${unit.canTerraform ? `<button class="btn" data-action="terraform-open" data-testid="terraform-open">Terraform this tile</button>` : ''}
          <button class="btn" data-action="toggle-search" data-testid="search-toggle">${unit.searching ? 'Stop searching' : 'Search'}</button>
          ${foe ? `<button class="btn danger" data-action="attack" data-testid="attack-btn">Attack ${esc(foe.name)}</button>` : ''}
        </div>
        ${unit.terraform ? `<p>Working on ${esc(projectLabel(unit.terraform.project))}, ${unit.terraform.turnsLeft} turns left.</p>` : ''}
        <div class="stack">
          <button class="btn small" data-action="open-social">Society</button>
          <button class="btn small" data-action="open-research">Research</button>
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
        <label>Production
          <select data-city="${city.id}" data-setting="production">
            <option value="">Choose a design</option>
            ${designs.map((design) => `<option value="${design.id}" ${city.production?.designId === design.id ? 'selected' : ''}>${esc(design.name)} (${design.cost})</option>`).join('')}
          </select>
        </label>
        ${city.production ? `<p>${city.production.progress} / ${city.production.cost}</p><button class="btn" data-action="rush" data-city="${city.id}" data-testid="rush-buy">Rush-buy</button>` : ''}
        <p class="muted">Income is 1 credit per population plus 2, before social bonuses.</p>`;
    }
    return `<h3>${esc(FACTIONS[game.state.playerFaction].name)}</h3><p class="muted">Select a unit or a city. The gold lines on the map are the edges of the twilight band. Outside it, units take ${outsideBandDamage(game.state.setup.difficulty)} damage a turn until Sealed Habitats / Geothermal Wells.</p>`;
  }

  private onTile(x: number, y: number) {
    const game = this.game;
    if (!game) return;
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
    const own = game.state.units.find((unit) => unit.x === x && unit.y === y && unit.factionId === game.state.playerFaction);
    if (own) {
      this.selectedUnit = own.id;
      this.selectedCity = null;
      this.refreshGame();
      return;
    }
    const city = game.cityAt(x, y);
    if (city && city.factionId === game.state.playerFaction) {
      this.selectedCity = city.id;
      this.selectedUnit = null;
      this.refreshGame();
    }
  }

  private onClick(event: MouseEvent) {
    const node = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!node) return;
    const action = node.dataset.action;
    if (action === 'play-intro') {
      this.audio.stopMusic();
      this.introIndex = 0;
      this.screen = 'intro';
      this.render();
    } else if (action === 'intro-next') {
      if (this.introIndex >= 5) this.exitIntro();
      else {
        this.introIndex += 1;
        this.render();
      }
    } else if (action === 'intro-back') {
      if (this.introIndex > 0) {
        this.introIndex -= 1;
        this.render();
      }
    } else if (action === 'intro-exit') this.exitIntro();
    else if (action === 'new-game') {
      this.screen = 'setup';
      this.render();
    } else if (action === 'back-menu') {
      this.screen = 'menu';
      this.game = null;
      this.render();
      if (this.audio.musicOn) this.audio.startMusic();
    } else if (action === 'game-options') {
      this.screen = 'options';
      this.render();
    } else if (action === 'quit') void this.exitDesktop();
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
    } else if (action === 'setup-axis') {
      const axis = node.dataset.axis as SocialAxis;
      this.setup.axes[axis] = node.dataset.option ?? this.setup.axes[axis];
      this.render();
    } else if (action === 'start-game') this.startGame();
    else if (action === 'load-game') void this.openLoad(false);
    else if (action === 'end-turn') this.endTurn();
    else if (action === 'select-unit') {
      this.selectedUnit = Number(node.dataset.id);
      this.selectedCity = null;
      this.refreshGame();
    } else if (action === 'select-city') {
      this.selectedCity = Number(node.dataset.id);
      this.selectedUnit = null;
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
    else if (action === 'open-spies') this.openSpies();
    else if (action === 'open-social') this.openSocial();
    else if (action === 'open-research') this.openResearch();
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
    else if (action === 'rush') this.act(() => this.game!.rushBuy(Number(node.dataset.city)), 'click');
    else if (action === 'close') this.closeOverlay();
    else if (action === 'resume') this.closeOverlay();
    else if (action === 'pause-save') void this.openSave('manual');
    else if (action === 'pause-load') void this.openLoad(true);
    else if (action === 'pause-tutorial') this.openTutorial(0);
    else if (action === 'tutorial-next') this.openTutorial(Number(node.dataset.step) + 1);
    else if (action === 'tutorial-back') this.openTutorial(Math.max(0, Number(node.dataset.step) - 1));
    else if (action === 'pause-new') this.askSaveFirst('new');
    else if (action === 'pause-exit') this.askSaveFirst('exit');
    else if (action === 'confirm-cancel') this.closeOverlay();
    else if (action === 'confirm-discard') void this.finishPending(false);
    else if (action === 'confirm-save') void this.openSave(this.pending?.mode === 'exit' ? 'then-exit' : 'then-new');
    else if (action === 'save-slot') void this.writeSlot(Number(node.dataset.slot), node.dataset.purpose ?? 'manual');
    else if (action === 'load-slot') void this.readSlot(Number(node.dataset.slot));
    else if (action === 'view-recap') {
      this.screen = 'recap';
      this.render();
    }
    if (action === 'difficulty') this.render();
    this.afterActionRefresh(action);
  }

  private afterActionRefresh(action: string | undefined) {
    const overlays = ['propose', 'accept-offer', 'reject-offer', 'recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep', 'switch-axis', 'research-pick', 'save-design', 'rush'];
    if (action && overlays.includes(action) && this.screen === 'game') {
      if (action === 'open-diplomacy' || action.startsWith('propose') || action.includes('offer')) this.openDiplomacy();
      else if (['recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep'].includes(action)) this.openSpies();
      else if (action === 'switch-axis') this.openSocial();
      else if (action === 'research-pick') this.openResearch();
      else this.refreshGame();
    }
  }

  private onChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.setting === 'allied') this.setup.allied = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'events') this.setup.events = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'autosave' && this.game) {
      this.game.state.autosaveEnabled = (target as HTMLInputElement).checked;
    }
    if (target.dataset.setting === 'music') this.audio.setMusic((target as HTMLInputElement).checked);
    if (target.dataset.setting === 'sfx') this.audio.setSfx((target as HTMLInputElement).checked);
    if (target.dataset.setting === 'mode') this.audio.setMode((target as HTMLSelectElement).value as 'loop' | 'shuffle');
    if (target.dataset.setting === 'track') this.audio.setTrack(target.value as (typeof TRACKS)[number]['id']);
    if (target.dataset.personality && target.dataset.trait) {
      const id = target.dataset.personality as FactionId;
      const trait = target.dataset.trait as keyof (typeof this.setup.personalities)[FactionId];
      this.setup.personalities[id] = { ...this.setup.personalities[id], [trait]: target.value };
    }
    if (target.dataset.setting === 'production' && this.game) {
      const design = target.value;
      if (design) this.act(() => this.game!.setProduction(Number(target.dataset.city), design), 'click');
    }
  }

  private onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const key = target.dataset.volume as 'master' | 'music' | 'sfx' | 'ambient' | undefined;
    if (!key) return;
    this.audio[key] = Number(target.value);
    this.audio.persist();
    const label = target.parentElement?.querySelector('b');
    if (label) label.textContent = String(Math.round(Number(target.value) * 100));
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
  }

  private endTurn() {
    const game = this.game;
    if (!game) return;
    const logBefore = snapshotLog(game.state.log);
    const workBefore = snapshotTerraform(game.state.units, game.state.playerFaction);
    const ended = game.endTurn();
    this.audio.play('turn');
    playTerraformProgress(this.audio, workBefore, snapshotTerraform(game.state.units, game.state.playerFaction));
    playLoggedCues(this.audio, logBefore, game.state.log, game.state.playerFaction);
    this.toast(ended.message);
    if (ended.autosave) void this.writeSlot(0, 'autosave');
    this.refreshGame();
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
          ${preview.navalBombardment ? '<p>A ship can weaken a city. It cannot capture one.</p>' : ''}
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
        <p class="muted">Fee ${fee} credits on this ${esc(biomeClass(tile))} tile. Tech level ${level}. One terraformer to a tile, and they can work anywhere.</p>
        <div class="stack">
          ${PROJECTS.map((project) => {
            const turns = terraformTurns(project.id, level);
            const locked = project.id === 'atmosphere' && !game.state.factions[unit.factionId].techs.includes('atmosphere');
            return `<button class="btn" data-action="terraform-pick" data-project="${project.id}" data-testid="terraform-${project.id}" ${locked ? 'disabled' : ''}>${esc(project.label)} · ${turns} turns · ${esc(project.detail)}</button>`;
          }).join('')}
        </div>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
  }

  private openDiplomacy() {
    const game = this.game!;
    const me = game.state.playerFaction;
    const offers = game.state.offers.filter((offer) => offer.to === me);
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal" data-testid="diplomacy-screen">
        <p class="eyebrow">Diplomacy</p>
        <h2>The ladder</h2>
        <p class="muted">War, then peace, then a non-aggression pact, then an alliance. Research and exploration treaties can sit beside peace or above. No unit has to make contact first.</p>
        ${offers.map((offer) => `<p>${esc(FACTIONS[offer.from].name)} offers ${esc(proposalLabel(offer.kind))}. <button class="btn small" data-action="accept-offer" data-id="${offer.id}">Accept</button> <button class="btn small" data-action="reject-offer" data-id="${offer.id}">Reject</button></p>`).join('')}
        ${FACTION_IDS.filter((id) => id !== me).map((id) => {
          const rel = game.relation(me, id);
          const standing = rel.stance === 'nap' ? 'non-aggression pact' : rel.stance;
          const actions: [string, string][] = [
            ['war', 'Declare war'],
            ['peace', 'Offer peace'],
            ['nap', 'Non-aggression'],
            ['alliance', 'Alliance'],
            ['research', 'Research treaty'],
            ['exploration', 'Share maps'],
          ];
          return `<section>
            <h3>${esc(FACTIONS[id].name)}</h3>
            <p class="muted">Standing: ${esc(standing)}. Grievance ${rel.memory}. Research treaty ${rel.research ? 'yes' : 'no'}. Exploration treaty ${rel.exploration ? 'yes' : 'no'}.</p>
            <div class="row">
              ${actions.map(([kind, label]) => `<button class="btn small" data-action="propose" data-target="${id}" data-kind="${kind}">${esc(label)}</button>`).join('')}
            </div>
          </section>`;
        }).join('')}
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
    this.refreshGame();
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

  private openResearch() {
    const faction = this.game!.state.factions[this.game!.state.playerFaction];
    const available = TECHS.filter((tech) => tech.cost > 0 && techAvailable(tech, faction.techs));
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal">
        <h2>Research</h2>
        <p class="muted">${faction.researchPoints} points banked.${faction.researching ? ` Current: ${esc(techById(faction.researching)?.name ?? '')}.` : ''}</p>
        <div class="stack">
          ${available.map((tech) => `<button class="btn" data-action="research-pick" data-tech="${tech.id}">${esc(tech.name)} · ${tech.cost} · ${esc(tech.blurb)}</button>`).join('') || '<p>Nothing left to study.</p>'}
        </div>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
  }

  private openDesign() {
    const techs = this.game!.state.factions[this.game!.state.playerFaction].techs;
    const options = (parts: { id: string; name: string; req: string | null }[]) =>
      parts.filter((part) => partKnown(part.req, techs)).map((part) => `<option value="${part.id}">${esc(part.name)}</option>`).join('');
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow">
        <h2>Design a unit</h2>
        <label>Name <input id="design-name" value="Field design"/></label>
        <label>Chassis <select id="design-chassis">${options(CHASSIS)}</select></label>
        <label>Weapon <select id="design-weapon">${options(WEAPONS)}</select></label>
        <label>Armor <select id="design-armor">${options(ARMORS)}</select></label>
        <div class="stack">${SPECIALS.filter((part) => partKnown(part.req, techs)).map((part) => `<label><input type="checkbox" value="${part.id}" class="design-special"/> ${esc(part.name)}</label>`).join('')}</div>
        <button class="btn primary" data-action="save-design">Save design</button>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
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
        <p data-testid="pause-difficulty">Difficulty: ${esc(difficultyLabel(this.game?.state.setup.difficulty))}. ${esc(difficultyProfile(this.game?.state.setup.difficulty).blurb)}</p>
        <h3>Audio</h3>
        <label class="row"><input type="checkbox" data-setting="music" ${this.audio.musicOn ? 'checked' : ''}/> Music</label>
        <label class="row"><input type="checkbox" data-setting="sfx" ${this.audio.sfxOn ? 'checked' : ''}/> Sound effects</label>
        ${(['master', 'music', 'sfx', 'ambient'] as const).map((key) => `<label class="slider">${key} <input type="range" min="0" max="1" step="0.01" value="${this.audio[key]}" data-volume="${key}"/><b>${Math.round(this.audio[key] * 100)}</b></label>`).join('')}
        <label class="row">Track <select data-setting="track">${TRACKS.map((track) => `<option value="${track.id}" ${this.audio.track === track.id ? 'selected' : ''}>${esc(track.name)}</option>`).join('')}</select></label>
        <label class="row">Order <select data-setting="mode"><option value="loop" ${this.audio.mode === 'loop' ? 'selected' : ''}>Loop</option><option value="shuffle" ${this.audio.mode === 'shuffle' ? 'selected' : ''}>Shuffle</option></select></label>
        <h3>Saves</h3>
        <label class="row" data-testid="autosave-toggle"><input type="checkbox" data-setting="autosave" ${autosave ? 'checked' : ''}/> Autosave every ${CONFIG.autosaveEveryTurns} turns</label>
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

  private openTutorial(step: number) {
    const pages = TUTORIAL;
    const index = Math.min(pages.length - 1, Math.max(0, step));
    const page = pages[index];
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="tutorial">
        <p class="eyebrow">Tutorial ${index + 1} / ${pages.length}</p>
        <h2>${esc(page.title)}</h2>
        <p>${esc(page.body)}</p>
        <div class="row">
          <button class="btn" data-action="tutorial-back" data-step="${index}" ${index === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn" data-action="tutorial-next" data-testid="tutorial-next" data-step="${index}">${index === pages.length - 1 ? 'Done' : 'Next'}</button>
          <button class="btn" data-action="close" data-testid="tutorial-close">Close</button>
        </div>
      </div></div>`;
    if (index === pages.length - 1) {
      const next = this.overlay.querySelector('[data-action="tutorial-next"]');
      next?.setAttribute('data-action', 'close');
    }
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
    const list = await this.saves.list();
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow" data-testid="save-list">
        <h2>Save game</h2>
        <p class="muted">Nine manual slots. The autosave is separate and always listed first when you load.</p>
        <div class="stack">
          ${list.filter((slot) => slot.slot !== 0).map((slot) => `<button class="btn" data-action="save-slot" data-testid="save-slot-${slot.slot}" data-slot="${slot.slot}" data-purpose="${purpose}">Slot ${slot.slot}${slot.empty ? ' · empty' : ` · ${esc(slot.label ?? '')}`}</button>`).join('')}
        </div>
        <button class="btn" data-action="close">Cancel</button>
      </div></div>`;
  }

  private async openLoad(fromGame: boolean) {
    const list = await this.saves.list();
    const html = `
      <div class="modal-back"><div class="modal narrow">
        <h2>Load game</h2>
        <div class="stack" data-testid="load-list">
          ${list.map((slot) => `<button class="btn" data-action="load-slot" data-testid="load-slot-${slot.slot}" data-slot="${slot.slot}" ${slot.empty ? 'disabled' : ''}>${slot.slot === 0 ? 'Autosave' : `Slot ${slot.slot}`}${slot.empty ? ' · empty' : ` · ${esc(slot.label ?? '')}`}</button>`).join('')}
        </div>
        <button class="btn" data-action="close">Close</button>
      </div></div>`;
    if (!fromGame && this.screen !== 'game') {
      this.overlay.innerHTML = html;
    } else this.overlay.innerHTML = html;
  }

  private async writeSlot(slot: number, purpose: string) {
    if (!this.game) return;
    const envelope = this.envelope(slot);
    await this.saves.write(slot, envelope);
    this.audio.play('save');
    this.toast(slot === 0 ? 'Autosaved.' : `Saved to slot ${slot}.`);
    if (purpose === 'then-new' || purpose === 'then-exit') await this.finishPending(true);
    else if (purpose === 'manual') this.openPause();
  }

  private async readSlot(slot: number) {
    const data = await this.saves.read(slot);
    if (!data?.state) {
      this.toast('That slot is empty.');
      return;
    }
    this.game = Game.fromState(data.state as GameState);
    this.selectedUnit = null;
    this.selectedCity = null;
    this.overlay.innerHTML = '';
    this.screen = 'game';
    this.gameMounted = false;
    this.render();
    this.toast(`Loaded ${data.label}.`);
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
      version: 1,
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
    if (this.audio.musicOn) this.audio.startMusic();
  }

  private closeOverlay() {
    this.overlay.innerHTML = '';
  }

  private openVictory() {
    const game = this.game!;
    const names = game.state.winner?.factions.map((id) => FACTIONS[id].name).join(', ');
    this.overlay.innerHTML = `
      <div class="modal-back"><div class="modal narrow">
        <h2>${game.state.winner?.factions.includes(game.state.playerFaction) ? 'Victory' : 'Defeat'}</h2>
        <p>${esc(names ?? '')} ${game.state.winner?.kind === 'alliance' ? 'share the victory.' : 'holds every city.'}</p>
        <button class="btn primary" data-action="view-recap" data-testid="view-recap">Social recap</button>
      </div></div>`;
  }

  private factionButton(id: FactionId) {
    const faction = FACTIONS[id];
    return `<button class="faction-card ${this.setup.faction === id ? 'on' : ''}" data-action="pick-faction" data-faction="${id}" data-testid="faction-${id}"><canvas data-emblem="${id}" width="42" height="42"></canvas><span><strong>${esc(faction.name)}</strong><br/><span class="muted">${esc(faction.idea)}</span></span></button>`;
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
    this.stage.querySelectorAll('canvas[data-emblem]').forEach((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawEmblem(ctx, canvas.dataset.emblem as FactionId, canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4);
    });
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
    };
    game.state.units.push(unit);
    game.relation(game.state.playerFaction, foe).stance = 'war';
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (game.inBounds(x + dx, y + dy)) game.state.explored[game.state.playerFaction][(y + dy) * game.state.width + (x + dx)] = true;
      }
    }
    this.selectedUnit = scout.id;
    this.refreshGame();
    return { x, y, name: unit.name };
  }

  private debugRecap() {
    const game = this.game;
    if (!game) return;
    const current = game.state.factions[game.state.playerFaction].axes;
    game.state.axisHistory.push({ round: Math.max(2, game.state.round), axes: { ...current, values: 'curiosity' } });
    game.state.winner = { kind: 'solo', factions: [game.state.playerFaction] };
    this.overlay.innerHTML = '';
    this.screen = 'recap';
    this.render();
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

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

const TUTORIAL = [
  { title: 'The twilight band', body: 'Proxima b does not turn. The day side burns, the night side freezes, and a marked band between them is where a city can be founded. Gold lines on the map are the edges of that band.' },
  { title: 'Weeks', body: 'You move first. Then each rival takes a turn, in an order that changes every week. The top bar shows the year and week, starting at Year 2460, Week 1. There is no turn limit.' },
  { title: 'Travel', body: 'Units can walk anywhere, including the day and night sides. Outside the livable zone they take damage each turn until they return, die, or you research Sealed Habitats / Geothermal Wells.' },
  { title: 'Cities', body: 'A colony pod is consumed to found a city inside the band. Cities earn credits equal to their population plus two, and they gather minerals, nutrients, energy, and research from nearby tiles.' },
  { title: 'Terraforming', body: 'A terraformer works one tile at a time, anywhere, with no need for a neighboring strip. Farms, trees, mines, and solar panels take different numbers of turns and cost more credits on harsh ground. Finished work can pull a tile into the livable zone.' },
  { title: 'Combat', body: 'An attack shows the odds before you confirm. Terrain such as ridges and forests favors the defender. A weaker unit can still win the roll. Capturing every rival city wins the game.' },
  { title: 'Society', body: 'Religion, values, economy, and politics each grant +10% when the choice matches your faction. Changing an axis mid-game costs credits and shakes stability for several turns.' },
  { title: 'Diplomacy', body: 'From the diplomacy screen you can declare war, make peace, offer a non-aggression pact, ally, or sign research and exploration treaties. A pact sits one step below an alliance. Rivals answer according to their personalities.' },
  { title: 'Spies', body: 'Recruiting a spy costs credits once and never again. Place them in another faction to watch that faction\'s map, stocks, and research. They can steal tech, sabotage works, or frame two rivals so those rivals blame each other. A sweep roots out spies in your own house.' },
  { title: 'The Waking Reactor', body: 'After a long quiet, the buried ark core starts to pulse. The band frays, unanchored units take rising damage, and yields thin. Terraforming anchors a tile. The exact week it begins is a setting, not a secret calendar.' },
  { title: 'Saves', body: 'Escape opens the pause menu. Autosave is always listed there and can be turned off. There are nine manual slots plus one autosave. On the desktop build those files live in your Proxima app-data folder.' },
];

void formatCalendar;
