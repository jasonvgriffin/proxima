import type { App } from './app';
import { CONFIG } from '../config';
import { LEADERS } from '../art/leaders';
import { unitContactSheetMarkup } from '../art/sheet';
import { FACTIONS } from '../core/factions';
import { eventPromptFor } from '../core/events';
import { isHostileClimate } from '../core/geography';
import { isSea } from '../core/rules';
import { starterDesigns } from '../core/parts';
import { FACTION_IDS, type DiplomaticOffer, type FactionId, type Unit } from '../core/types';
import { esc } from './text';

export function debugDefeat(this: App) {
  const game = this.game;
  if (!game) return;
  const player = game.state.playerFaction;
  game.state.cities = game.state.cities.filter((city) => city.factionId !== player);
  game.state.units = game.state.units.filter((unit) => unit.factionId !== player);
  game.state.playerDefeated = true;
  this.overlay.innerHTML = '';
  this.refreshGame();
}

export function debugTrade(this: App) {
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

export function debugEvent(this: App, kind?: string) {
  const game = this.game;
  if (!game) return;
  const eventKind = kind === 'wreckage' || kind === 'betrayal' || kind === 'dust-storm' || kind === 'seismic' ? kind : 'solar-flare';
  const prompt = eventPromptFor(eventKind, game.state.events.nextId++);
  if (eventKind === 'betrayal') {
    const other = FACTION_IDS.find((id) => id !== game.state.playerFaction);
    if (other) prompt.subject = other;
  }
  game.state.events.prompt = prompt;
  this.overlay.innerHTML = '';
  this.openEvent();
}

export function debugTransport(this: App) {
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

export function debugFinishTerraform(this: App): { x: number; y: number } | null {
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

export function debugMidgame(this: App) {
  const game = this.game;
  if (!game) return;
  const rivals = FACTION_IDS.filter((id) => id !== game.state.playerFaction);
  for (const id of rivals) {
    let added = 0;
    for (let y = 3; y < game.state.height - 2 && added < 2; y += 6) {
      for (let x = 2; x < game.state.width - 2 && added < 2; x += 5) {
        const tile = game.tile(x, y);
        if (isSea(tile.terrain) || tile.scarred || isHostileClimate(tile.terrain)) continue;
        const tooClose = game.state.cities.some(
          (city) => Math.max(Math.abs(city.x - x), Math.abs(city.y - y)) < CONFIG.city.minDistance,
        );
        if (tooClose) continue;
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
  }
  game.state.explored[game.state.playerFaction].fill(true);
  this.overlay.innerHTML = '';
  const home = game.citiesOf(game.state.playerFaction)[0];
  this.map?.centerOn(home?.x ?? 0, home?.y ?? Math.floor(game.state.height / 2));
  this.refreshGame();
}

export function showPortraitSheet(this: App) {
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

export function showUnitSheet(this: App) {
  this.stopMotion();
  this.overlay.innerHTML = '';
  this.screen = 'menu';
  this.stage.innerHTML = unitContactSheetMarkup();
  this.paintEmblems();
}

export function debugDiplomacy(this: App, faction?: string) {
  const game = this.game;
  if (!game) return;
  const id = (FACTION_IDS.find((entry) => entry === faction && entry !== game.state.playerFaction)
    ?? FACTION_IDS.find((entry) => entry !== game.state.playerFaction)) as FactionId;
  game.relation(game.state.playerFaction, id).contact = true;
  this.diplomacyFocus = id;
  this.openDiplomacy();
}

export function seedDiplomacyOffer(this: App) {
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

export function spawnRaider(this: App): { x: number; y: number; name: string } | null {
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

export function debugRecap(this: App) {
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

