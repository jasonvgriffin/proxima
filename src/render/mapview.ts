import { drawEmblem } from '../art/draw';
import { drawUnitSprite } from '../art/units';
import { FACTIONS } from '../core/factions';
import type { Game } from '../core/game';
import { isSea } from '../core/rules';
import type { FactionId, Recall, Tile } from '../core/types';
import { paintFogMasks } from './fog';
import { CHUNK, TILE_PX, chunkCount, chunkHash, drawTileWorks, minimapColor, minimapPixels, paintChunk } from './terrain';

const TILE = TILE_PX;

interface ChunkSlot {
  canvas: HTMLCanvasElement;
  hash: string;
}

/**
 * Map camera, terrain cache, and fog. Unit pictures are drawn only in
 * `drawUnits`, so replacement art can drop in there.
 */
export class MapView {
  camera = { x: 0, y: 0, zoom: 1.25 };
  hover: { x: number; y: number } | null = null;
  showGrid = false;
  private raf = 0;
  private anim = 0;
  private dragging = false;
  private dragMoved = false;
  private last = { x: 0, y: 0 };
  private tile = TILE;
  private dirty = true;
  private seenRevision = -1;
  private chunks: ChunkSlot[] = [];
  private world: HTMLCanvasElement | null = null;
  private shade: HTMLCanvasElement | null = null;
  private shroud: HTMLCanvasElement | null = null;
  private remembered: HTMLCanvasElement | null = null;
  private layerRevision = -1;
  private builtFor = { width: 0, height: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private getGame: () => Game,
    private getSelection: () => { unitId: number | null; cityId: number | null; reach: Set<string> },
    private onTile: (x: number, y: number, mods: { shift: boolean; alt: boolean }) => void,
    private onHover: (label: string) => void,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointerleave', this.up);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointerleave', this.up);
    this.canvas.removeEventListener('wheel', this.wheel);
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.dirty = true;
  }

  centerOn(tx: number, ty: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.x = rect.width / 2 - (tx + 0.5) * this.tile * this.camera.zoom;
    this.camera.y = rect.height / 2 - (ty + 0.5) * this.tile * this.camera.zoom;
    this.dirty = true;
  }

  /** Viewport point at the center of a map tile. Used by the smoke test. */
  clientPoint(tx: number, ty: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const size = this.tile * this.camera.zoom;
    return {
      x: rect.left + this.camera.x + (tx + 0.5) * size,
      y: rect.top + this.camera.y + (ty + 0.5) * size,
    };
  }

  private frame = () => {
    this.anim += 0.016;
    const game = this.getGame();
    if (game.revision !== this.seenRevision) {
      this.seenRevision = game.revision;
      this.dirty = true;
    }
    this.draw();
    this.dirty = false;
    this.raf = requestAnimationFrame(this.frame);
  };

  private down = (event: PointerEvent) => {
    this.dragging = true;
    this.dragMoved = false;
    this.last = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private move = (event: PointerEvent) => {
    if (this.dragging) {
      const dx = event.clientX - this.last.x;
      const dy = event.clientY - this.last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
      this.camera.x += dx;
      this.camera.y += dy;
      this.last = { x: event.clientX, y: event.clientY };
      this.dirty = true;
    }
    const tile = this.tileAt(event.clientX, event.clientY);
    const changed = tile?.x !== this.hover?.x || tile?.y !== this.hover?.y;
    this.hover = tile;
    if (changed) this.dirty = true;
    this.onHover(tile ? this.label(tile.x, tile.y) : '');
  };

  private up = (event: PointerEvent) => {
    if (event.type === 'pointerup' && !this.dragMoved) {
      const tile = this.tileAt(event.clientX, event.clientY);
      if (tile) this.onTile(tile.x, tile.y, { shift: event.shiftKey, alt: event.altKey });
    }
    this.dragging = false;
    this.dragMoved = false;
  };

  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    const next = Math.min(2.2, Math.max(0.55, this.camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    const rect = this.canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const worldX = (px - this.camera.x) / this.camera.zoom;
    const worldY = (py - this.camera.y) / this.camera.zoom;
    this.camera.zoom = next;
    this.camera.x = px - worldX * next;
    this.camera.y = py - worldY * next;
    this.dirty = true;
  };

  private tileAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const game = this.getGame();
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - this.camera.x) / (this.tile * this.camera.zoom));
    const y = Math.floor((clientY - rect.top - this.camera.y) / (this.tile * this.camera.zoom));
    if (!game.inBounds(x, y)) return null;
    return { x, y };
  }

  private label(x: number, y: number): string {
    const game = this.getGame();
    const mask = this.fogAt(game, x, y);
    if (mask === 0) return 'Unexplored';
    const seen = this.seenTile(game, x, y, mask);
    const bits = [seen.terrain.replace(/-/g, ' ')];
    if (seen.river) bits.push('river');
    if (seen.resource) bits.push(seen.resource);
    if (seen.special) bits.push(seen.special);
    if (seen.improvement) bits.push(seen.improvement);
    if (seen.road) bits.push('road');
    if (seen.scarred) bits.push('scarred');
    if (mask === 1) bits.push('remembered');
    return bits.join(' · ');
  }

  draw() {
    const canvas = this.canvas;
    const game = this.getGame();
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.syncLayers(game);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    const worldW = game.state.width * TILE;
    const worldH = game.state.height * TILE;
    if (this.world) ctx.drawImage(this.world, 0, 0);
    if (this.shade) ctx.drawImage(this.shade, 0, 0);
    if (this.shroud) ctx.drawImage(this.shroud, 0, 0, worldW, worldH);
    const view = this.visibleRange(rect.width, rect.height);
    if (this.showGrid) this.drawGrid(ctx, game, view);
    this.drawWorks(ctx, game, view);
    this.drawCities(ctx, game, view);
    this.drawUnits(ctx, game, view);
    this.drawOverlay(ctx, game, view);
    ctx.restore();
    this.drawMinimap(ctx, game, rect.width, rect.height);
  }

  private syncLayers(game: Game) {
    const width = game.state.width;
    const height = game.state.height;
    const sizeChanged = this.builtFor.width !== width || this.builtFor.height !== height;
    if (!sizeChanged && this.layerRevision === game.revision && this.world && this.shroud && this.shade) return;
    this.layerRevision = game.revision;
    if (sizeChanged) {
      this.chunks = [];
      this.builtFor = { width, height };
    }
    const { cols, rows } = chunkCount(width, height);
    const needed = cols * rows;
    while (this.chunks.length < needed) {
      this.chunks.push({ canvas: document.createElement('canvas'), hash: '' });
    }
    this.chunks.length = needed;
    let changed = false;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const slot = this.chunks[cy * cols + cx];
        const hash = chunkHash(game.state.tiles, game.state.width, game.state.height, cx, cy);
        if (slot.hash === hash && slot.canvas.width > 0) continue;
        paintChunk(game.state.tiles, game.state.width, game.state.height, cx, cy, slot.canvas);
        slot.hash = hash;
        changed = true;
      }
    }
    const worldW = game.state.width * TILE;
    const worldH = game.state.height * TILE;
    if (!this.world) this.world = document.createElement('canvas');
    if (this.world.width !== worldW || this.world.height !== worldH || changed) {
      this.world.width = worldW;
      this.world.height = worldH;
      const wctx = this.world.getContext('2d');
      if (wctx) {
        wctx.fillStyle = '#071018';
        wctx.fillRect(0, 0, worldW, worldH);
        for (let cy = 0; cy < rows; cy++) {
          for (let cx = 0; cx < cols; cx++) {
            const slot = this.chunks[cy * cols + cx];
            wctx.drawImage(slot.canvas, cx * CHUNK * TILE, cy * CHUNK * TILE);
          }
        }
      }
    }
    const mask = this.visionMask(game);
    if (!this.shroud) this.shroud = document.createElement('canvas');
    if (!this.remembered) this.remembered = document.createElement('canvas');
    paintFogMasks(this.shroud, this.remembered, mask, game.state.width, game.state.height);
    if (!this.shade) this.shade = document.createElement('canvas');
    this.shade.width = worldW;
    this.shade.height = worldH;
    const shade = this.shade.getContext('2d');
    if (shade && this.world && this.remembered) {
      shade.filter = 'saturate(0.12) brightness(0.58)';
      shade.drawImage(this.world, 0, 0);
      shade.filter = 'none';
      shade.globalCompositeOperation = 'destination-in';
      shade.drawImage(this.remembered, 0, 0, worldW, worldH);
      shade.globalCompositeOperation = 'source-over';
    }
  }

  private visionMask(game: Game): Uint8Array {
    const width = game.state.width;
    const height = game.state.height;
    const mask = new Uint8Array(width * height);
    const viewer = game.state.playerFaction;
    const watchers = [viewer, ...game.mapPartners(viewer)];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let state = 0;
        for (const id of watchers) {
          const fog = game.fogState(id, x, y);
          if (fog === 2) {
            state = 2;
            break;
          }
          if (state < 1 && fog === 1) state = 1;
        }
        mask[y * width + x] = state;
      }
    }
    return mask;
  }

  private fogAt(game: Game, x: number, y: number): number {
    const viewer = game.state.playerFaction;
    const watchers = [viewer, ...game.mapPartners(viewer)];
    let state = 0;
    for (const id of watchers) {
      const fog = game.fogState(id, x, y);
      if (fog === 2) return 2;
      if (fog === 1) state = 1;
    }
    return state;
  }

  private seenTile(game: Game, x: number, y: number, mask: number): Tile {
    if (mask === 2) return game.tile(x, y);
    const recall = this.recallAt(game, x, y);
    if (!recall) return game.tile(x, y);
    return {
      x,
      y,
      terrain: recall.terrain,
      elevation: recall.elevation,
      rainfall: recall.rainfall,
      temperature: recall.temperature,
      river: recall.river,
      resource: recall.resource,
      special: recall.special,
      improvement: recall.improvement,
      road: recall.road,
      scarred: recall.scarred,
      history: [],
    };
  }

  private recallAt(game: Game, x: number, y: number): Recall | null {
    const index = y * game.state.width + x;
    const viewer = game.state.playerFaction;
    const own = game.state.recall?.[viewer]?.[index];
    if (own) return own;
    for (const id of game.mapPartners(viewer)) {
      const shared = game.state.recall?.[id]?.[index];
      if (shared) return shared;
    }
    return null;
  }

  private visibleRange(width: number, height: number) {
    const game = this.getGame();
    const size = this.tile * this.camera.zoom;
    const x0 = Math.max(0, Math.floor(-this.camera.x / size) - 1);
    const y0 = Math.max(0, Math.floor(-this.camera.y / size) - 1);
    const x1 = Math.min(game.state.width - 1, Math.ceil((width - this.camera.x) / size) + 1);
    const y1 = Math.min(game.state.height - 1, Math.ceil((height - this.camera.y) / size) + 1);
    return { x0, y0, x1, y1 };
  }

  private drawCities(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const selected = this.getSelection().cityId;
    const drawn = new Set<string>();
    for (let y = view.y0; y <= view.y1; y++) {
      for (let x = view.x0; x <= view.x1; x++) {
        const mask = this.fogAt(game, x, y);
        if (mask === 0) continue;
        const live = mask === 2 ? game.cityAt(x, y) : undefined;
        const memory = mask === 1 ? this.recallAt(game, x, y)?.city : null;
        const city = live ?? memory;
        if (!city) continue;
        const key = `${x},${y}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const radius = s * 0.28;
        const px = x * s + s / 2;
        const py = y * s + radius + 1;
        ctx.save();
        if (mask === 1) ctx.globalAlpha = 0.72;
        drawEmblem(ctx, city.factionId, px, py, radius);
        if (live && city.id === selected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (this.camera.zoom > 0.9) {
          ctx.fillStyle = mask === 1 ? '#c5ced8' : '#f4f7fb';
          ctx.font = '10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(city.name, px, py + radius + 12);
          ctx.textAlign = 'left';
          ctx.fillText(String(city.population), px + radius + 2, py + 3);
        }
        ctx.restore();
      }
    }
  }

  /**
   * Unit sprites. Own units are always shown. Enemy units in sight are live.
   * Remembered tiles keep the last-seen enemy marker, dimmed, until looked at again.
   */
  private drawUnits(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const selected = this.getSelection().unitId;
    const viewer = game.state.playerFaction;
    const partners = game.mapPartners(viewer);
    const groups = new Map<string, typeof game.state.units>();
    const liveIds = new Set<number>();
    for (const unit of game.state.units) {
      if (unit.aboard != null) continue;
      if (unit.x < view.x0 || unit.x > view.x1 || unit.y < view.y0 || unit.y > view.y1) continue;
      const own = unit.factionId === viewer;
      const visible = own || this.fogAt(game, unit.x, unit.y) === 2 || partners.includes(unit.factionId);
      if (!visible) continue;
      liveIds.add(unit.id);
      const key = `${unit.x},${unit.y}`;
      const list = groups.get(key);
      if (list) list.push(unit);
      else groups.set(key, [unit]);
    }
    for (const list of groups.values()) {
      list.forEach((unit, index) => this.paintSprite(ctx, game, unit, index, list.length, s, unit.id === selected, false));
    }
    for (let y = view.y0; y <= view.y1; y++) {
      for (let x = view.x0; x <= view.x1; x++) {
        if (this.fogAt(game, x, y) !== 1) continue;
        const memory = this.recallAt(game, x, y);
        if (!memory) continue;
        memory.units.forEach((unit, index) => {
          if (unit.factionId === viewer || liveIds.has(unit.id)) return;
          this.paintSprite(
            ctx,
            game,
            {
              id: unit.id,
              x,
              y,
              role: unit.role,
              domain: unit.domain,
              factionId: unit.factionId,
              name: unit.name,
              designId: '',
              hp: 1,
              maxHp: 1,
              terraform: null,
              cargo: [],
            },
            index,
            memory.units.length,
            s,
            false,
            true,
          );
        });
      }
    }
  }

  private paintSprite(
    ctx: CanvasRenderingContext2D,
    game: Game,
    unit: {
      id: number;
      x: number;
      y: number;
      role: string;
      domain: string;
      factionId: FactionId;
      name: string;
      designId: string;
      hp: number;
      maxHp: number;
      terraform: unknown;
      cargo: readonly unknown[];
    },
    index: number,
    count: number,
    s: number,
    selected: boolean,
    ghost: boolean,
  ) {
    const px = unit.x * s + s / 2 + index * 5;
    const py = unit.y * s + s / 2 - index * 3;
    const faction = FACTIONS[unit.factionId];
    const design = unit.designId ? game.findDesign(unit.factionId, unit.designId) : undefined;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.45;
    drawUnitSprite(ctx, px, py, 24, {
      role: unit.role as 'settler',
      domain: unit.domain as 'land',
      chassis: design?.chassis,
      specials: design?.specials,
      name: unit.name,
      color: faction?.colors.main ?? '#ddd',
      deep: faction?.colors.deep ?? '#222',
      selected,
      hp: unit.hp,
      maxHp: unit.maxHp,
      stack: index === count - 1 ? count : 1,
      phase: this.anim + unit.id * 0.65,
      working: !!unit.terraform,
    });
    if (unit.cargo.length) {
      ctx.fillStyle = '#f4f7fb';
      ctx.beginPath();
      ctx.arc(unit.x * s + s - 6, unit.y * s + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const reach = this.getSelection().reach;
    ctx.fillStyle = 'rgba(111, 208, 196, 0.28)';
    for (const key of reach) {
      const [x, y] = key.split(',').map(Number);
      if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
      ctx.fillRect(x * s, y * s, s, s);
    }
    if (this.hover && game.inBounds(this.hover.x, this.hover.y)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.strokeRect(this.hover.x * s + 0.5, this.hover.y * s + 0.5, s - 1, s - 1);
    }
  }

  private drawWorks(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const dirs = [
      [1, 0, 1],
      [-1, 0, 2],
      [0, 1, 4],
      [0, -1, 8],
    ] as const;
    for (let y = view.y0; y <= view.y1; y++) {
      for (let x = view.x0; x <= view.x1; x++) {
        const mask = this.fogAt(game, x, y);
        if (mask === 0) continue;
        const recall = mask === 1 ? this.recallAt(game, x, y) : null;
        const live = mask === 2 ? game.tile(x, y) : null;
        const improvement = live ? live.improvement : (recall?.improvement ?? null);
        const road = live ? live.road : !!recall?.road;
        const working = live
          ? game.state.units.some((unit) => unit.x === x && unit.y === y && unit.terraform && unit.aboard == null)
          : !!recall?.working;
        if (!improvement && !road && !working) continue;
        let roads = 0;
        if (road) {
          for (const [dx, dy, bit] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (!game.inBounds(nx, ny)) continue;
            const neighbor = this.fogAt(game, nx, ny);
            if (neighbor === 0) continue;
            const linked = neighbor === 2 ? game.tile(nx, ny).road : !!this.recallAt(game, nx, ny)?.road;
            if (linked) roads |= bit;
          }
        }
        ctx.save();
        if (mask === 1) ctx.filter = 'saturate(0.2) brightness(0.78)';
        drawTileWorks(ctx, x * s, y * s, s, improvement, road, roads, working);
        ctx.restore();
      }
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    ctx.strokeStyle = 'rgba(232, 236, 244, 0.16)';
    ctx.lineWidth = 1;
    for (let x = view.x0; x <= view.x1; x++) {
      ctx.beginPath();
      ctx.moveTo(x * s + 0.5, view.y0 * s);
      ctx.lineTo(x * s + 0.5, (view.y1 + 1) * s);
      ctx.stroke();
    }
    for (let y = view.y0; y <= view.y1; y++) {
      ctx.beginPath();
      ctx.moveTo(view.x0 * s, y * s + 0.5);
      ctx.lineTo((view.x1 + 1) * s, y * s + 0.5);
      ctx.stroke();
    }
    void game;
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number) {
    const panel = minimapPixels(game.state.width, game.state.height);
    const mw = panel.width;
    const mh = panel.height;
    const x0 = 12;
    const y0 = height - mh - 12;
    ctx.fillStyle = 'rgba(8,12,20,0.86)';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = 'rgba(180, 198, 214, 0.35)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, mw - 1, mh - 1);
    const sx = mw / game.state.width;
    const sy = mh / game.state.height;
    const mask = this.visionMask(game);
    for (let y = 0; y < game.state.height; y++) {
      for (let x = 0; x < game.state.width; x++) {
        const state = mask[y * game.state.width + x];
        if (state === 0) {
          ctx.fillStyle = '#0a0e16';
        } else {
          const tile = state === 2 ? game.tile(x, y) : this.seenTile(game, x, y, state);
          ctx.fillStyle = state === 1 ? dull(minimapColor(tile.terrain)) : isSea(tile.terrain) ? minimapColor(tile.terrain) : minimapColor(tile.terrain);
        }
        ctx.fillRect(x0 + x * sx, y0 + y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    for (let y = 0; y < game.state.height; y++) {
      for (let x = 0; x < game.state.width; x++) {
        if (mask[y * game.state.width + x] === 0) continue;
        const live = mask[y * game.state.width + x] === 2 ? game.cityAt(x, y) : undefined;
        const memory = mask[y * game.state.width + x] === 1 ? this.recallAt(game, x, y)?.city : null;
        const city = live ?? memory;
        if (!city) continue;
        ctx.fillStyle = FACTIONS[city.factionId]?.colors.main ?? '#fff';
        ctx.fillRect(x0 + x * sx, y0 + y * sy, Math.max(2, Math.ceil(sx)), Math.max(2, Math.ceil(sy)));
      }
    }
    const size = this.tile * this.camera.zoom;
    const vx = Math.max(0, -this.camera.x / size);
    const vy = Math.max(0, -this.camera.y / size);
    const vw = Math.min(game.state.width - vx, width / size);
    const vh = Math.min(game.state.height - vy, (height - 0) / size);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeRect(x0 + vx * sx, y0 + vy * sy, Math.max(4, vw * sx), Math.max(4, vh * sy));
  }
}

function dull(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return '#3a4250';
  const r = ((n >> 16) & 255) * 0.45 + 28;
  const g = ((n >> 8) & 255) * 0.45 + 32;
  const b = (n & 255) * 0.5 + 40;
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}
