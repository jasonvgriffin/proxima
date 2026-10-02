import type { App } from '../app';
import { cityInspector } from './city';
import { unitIconTag } from '../../art/units';
import { difficultyLabel } from '../../core/difficulty';
import { FACTIONS } from '../../core/factions';
import { PROJECTS, projectLabel } from '../../core/game';
import { eventPopupAction } from '../../core/events';
import { tileYield } from '../../core/economy';
import { biomeClass, formatCalendar, terraformEnergy, terraformFee, terraformTurns } from '../../core/rules';
import { historyActor } from '../../core/tilelog';
import { formerTechLevel, techById } from '../../core/tech';
import { type Unit } from '../../core/types';
import { MapView } from '../../render/mapview';
import { esc } from '../text';

export function mountGame(this: App) {
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

export function refreshGame(this: App) {
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
    <button class="btn small ${this.map?.showGrid ? 'on' : ''}" data-action="toggle-grid" data-testid="toggle-grid">${this.map?.showGrid ? 'Grid on' : 'Grid'}</button>
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
  const popupOpen = Boolean(this.overlay.querySelector('[data-testid="event-popup"]'));
  const popup = eventPopupAction(game.state.events.prompt, popupOpen);
  if (game.state.winner && !this.overlay.innerHTML) this.openVictory();
  else if (game.state.playerDefeated && !this.overlay.innerHTML) this.openDefeat();
  else if (popup === 'open' && !this.overlay.innerHTML) this.openEvent();
  else if (popup === 'close') {
    this.closeOverlay();
    if (game.state.winner) this.openVictory();
    else if (game.state.playerDefeated) this.openDefeat();
  }
  this.paintEmblems();
}

export function unitIcon(this: App, unit: Unit, large = false): string {
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

export function inspector(this: App): string {
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
  if (city && city.factionId === game.state.playerFaction) return cityInspector(game, city);
  if (this.focusTile) return this.tilePanel();
  return `<h3>${esc(FACTIONS[game.state.playerFaction].name)}</h3><p class="muted">Select a unit, a city, or a map tile. Press I over a tile, or shift-click it, for its history. Press T for the tech tree. Unexplored ground stays dark. Ground you have seen stays dim, including the works last seen there. Harsh climates wear a unit down until you research Sealed Habitats. Geothermal Wells later add energy on rocky ground.</p>`;
}

export function tilePanel(this: App): string {
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
  const techs = game.state.factions[game.state.playerFaction].techs;
  const asTile = (improvement: typeof sight.improvement) => ({
    x: focus.x,
    y: focus.y,
    terrain: sight.terrain,
    elevation: sight.elevation,
    rainfall: sight.rainfall,
    temperature: sight.temperature,
    river: sight.river,
    resource: sight.resource,
    special: sight.special,
    improvement,
    road: sight.road,
    scarred: sight.scarred,
    history: [],
  });
  const bare = tileYield(asTile(null), techs);
  const now = tileYield(asTile(sight.improvement), techs);
  const yieldText = (['minerals', 'nutrients', 'energy', 'research'] as const)
    .map((key) => (now[key] === bare[key] ? `${key} ${now[key]}` : `${key} ${bare[key]} → ${now[key]}`))
    .join(', ');
  const climate = sight.terrain.replace(/-/g, ' ');
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
      <p data-testid="tile-state">${esc(climate)}${sight.river ? ' · river' : ''}${sight.resource ? ` · ${esc(sight.resource)}` : ''}${sight.special ? ` · ${esc(sight.special)}` : ''}</p>
      <p data-testid="tile-improvements">${esc(lines)}</p>
      <p data-testid="tile-yields">${esc(yieldText)}</p>
      ${working}
      <h3>History</h3>
      <ul data-testid="tile-history">${history}</ul>
      ${back}
    </div>`;
}

export function openTile(this: App, x: number, y: number) {
  this.focusTile = { x, y };
  this.preferTile = true;
  this.refreshGame();
}

export function onTile(this: App, x: number, y: number, mods: { shift: boolean; alt: boolean } = { shift: false, alt: false }) {
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

export function openCombat(this: App, attackerId: number, x: number, y: number) {
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

export function openTerraform(this: App) {
  const game = this.game!;
  const unit = game.unitById(this.selectedUnit ?? -1);
  if (!unit) return;
  const tile = game.tile(unit.x, unit.y);
  const fee = terraformFee(biomeClass(tile));
  const level = formerTechLevel(game.state.factions[unit.factionId].techs);
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal narrow" data-testid="terraform-menu">
      <h2>Terraform</h2>
      <p class="muted">Fee ${fee} credits plus energy on this ${esc(biomeClass(tile))} tile. Tech level ${level}. Only atmosphere work softens a harsh climate. One terraformer to a tile, and they can work anywhere.</p>
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

export function adjacentFoe(this: App, unit: Unit): { x: number; y: number; name: string } | null {
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

export function openVictory(this: App) {
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

export function openDefeat(this: App) {
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

export function openEvent(this: App) {
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

