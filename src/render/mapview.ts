import { CONFIG } from '../config';
import { TERRAIN_PAINT, drawEmblem, hash } from '../art/draw';
import { FACTIONS } from '../core/factions';
import type { Game } from '../core/game';
import { isSea } from '../core/rules';
import type { FactionId } from '../core/types';

export class MapView {
  camera = { x: 0, y: 0, zoom: 1.25 };
  hover: { x: number; y: number } | null = null;
  private raf = 0;
  private dragging = false;
  private dragMoved = false;
  private last = { x: 0, y: 0 };
  private tile = 34;

  constructor(
    private canvas: HTMLCanvasElement,
    private getGame: () => Game,
    private getSelection: () => { unitId: number | null; cityId: number | null; reach: Set<string> },
    private onTile: (x: number, y: number) => void,
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

  centerOn(tx: number, ty: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.x = rect.width / 2 - (tx + 0.5) * this.tile * this.camera.zoom;
    this.camera.y = rect.height / 2 - (ty + 0.5) * this.tile * this.camera.zoom;
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
    this.draw();
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
    }
    const tile = this.tileAt(event.clientX, event.clientY);
    this.hover = tile;
    this.onHover(tile ? this.label(tile.x, tile.y) : '');
  };

  private up = (event: PointerEvent) => {
    if (!this.dragMoved) {
      const tile = this.tileAt(event.clientX, event.clientY);
      if (tile) this.onTile(tile.x, tile.y);
    }
    this.dragging = false;
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
    if (!game.playerSees(x, y)) return 'Unexplored';
    const tile = game.tile(x, y);
    const zone = tile.zone === 'twilight' ? 'Twilight band' : tile.zone === 'day' ? 'Day side' : 'Night side';
    const bits = [zone, tile.terrain.replace('-', ' ')];
    if (tile.resource) bits.push(tile.resource);
    if (tile.improvement) bits.push(tile.improvement);
    if (tile.scarred) bits.push('scarred');
    if (!game.isVisible(game.state.playerFaction, x, y) && game.playerSees(x, y)) bits.push('shared or remembered');
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, rect.width, rect.height);
    const size = this.tile * this.camera.zoom;
    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    const view = this.visibleRange(rect.width, rect.height);
    for (let y = view.y0; y <= view.y1; y++) {
      for (let x = view.x0; x <= view.x1; x++) this.drawTile(ctx, game, x, y);
    }
    this.drawBandRails(ctx, game);
    this.drawUnits(ctx, game, view);
    this.drawCities(ctx, game, view);
    ctx.restore();
    this.drawMinimap(ctx, game, rect.width, rect.height);
    this.drawLegend(ctx, rect.width);
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

  private drawTile(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number) {
    const s = this.tile;
    const px = x * s;
    const py = y * s;
    const known = game.playerSees(x, y);
    if (!known) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0c1018' : '#10151f';
      ctx.fillRect(px, py, s, s);
      return;
    }
    const tile = game.tile(x, y);
    const paint = TERRAIN_PAINT[tile.terrain] ?? ['#333', '#222'];
    ctx.fillStyle = paint[0];
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = paint[1];
    const n = hash(x, y);
    ctx.fillRect(px + (n * (s - 6)), py + 4, 3, 3);
    if (tile.zone === 'twilight') {
      ctx.fillStyle = 'rgba(150, 130, 210, 0.13)';
      ctx.fillRect(px, py, s, s);
    }
    if (tile.resource) {
      ctx.fillStyle = tile.resource === 'minerals' ? '#d7c4a3' : tile.resource === 'nutrients' ? '#b6e38a' : tile.resource === 'energy' ? '#f0c36a' : '#d0d6ea';
      ctx.fillRect(px + s - 8, py + 4, 4, 4);
    }
    if (tile.improvement) {
      ctx.strokeStyle = 'rgba(224,177,92,0.8)';
      ctx.strokeRect(px + 4, py + 4, s - 8, s - 8);
    }
    if (tile.scarred) {
      ctx.strokeStyle = 'rgba(225,93,79,0.8)';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 6);
      ctx.lineTo(px + s - 4, py + s - 6);
      ctx.stroke();
    }
    const live = game.isVisible(game.state.playerFaction, x, y) || game.mapPartners(game.state.playerFaction).some((id) => game.isVisible(id, x, y));
    if (!live) {
      ctx.fillStyle = 'rgba(7,9,16,0.42)';
      ctx.fillRect(px, py, s, s);
    }
    const key = `${x},${y}`;
    if (this.getSelection().reach.has(key)) {
      ctx.fillStyle = 'rgba(111, 208, 196, 0.28)';
      ctx.fillRect(px, py, s, s);
    }
    if (this.hover && this.hover.x === x && this.hover.y === y) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    }
  }

  private drawBandRails(ctx: CanvasRenderingContext2D, game: Game) {
    const s = this.tile;
    ctx.fillStyle = 'rgba(224, 177, 92, 0.85)';
    ctx.fillRect(CONFIG.map.bandStart * s - 1, 0, 2, game.state.height * s);
    ctx.fillRect((CONFIG.map.bandEnd + 1) * s - 1, 0, 2, game.state.height * s);
  }

  private drawCities(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const selected = this.getSelection().cityId;
    for (const city of game.state.cities) {
      if (city.x < view.x0 || city.x > view.x1 || city.y < view.y0 || city.y > view.y1) continue;
      if (city.factionId !== game.state.playerFaction && !game.playerSees(city.x, city.y)) continue;
      const radius = s * 0.28;
      const px = city.x * s + s / 2;
      const py = city.y * s + radius + 1;
      drawEmblem(ctx, city.factionId, px, py, radius);
      if (city.id === selected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (this.camera.zoom > 0.9) {
        ctx.fillStyle = '#f4f7fb';
        ctx.font = '10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textAlign = 'center';
        ctx.fillText(city.name, px, py + radius + 12);
        ctx.textAlign = 'left';
        ctx.fillText(String(city.population), px + radius + 2, py + 3);
      }
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D, game: Game, view: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this.tile;
    const selected = this.getSelection().unitId;
    const stacks = new Map<string, number>();
    for (const unit of game.state.units) {
      if (unit.x < view.x0 || unit.x > view.x1 || unit.y < view.y0 || unit.y > view.y1) continue;
      const own = unit.factionId === game.state.playerFaction;
      const visible =
        own ||
        game.isVisible(game.state.playerFaction, unit.x, unit.y) ||
        game.mapPartners(game.state.playerFaction).includes(unit.factionId);
      if (!visible) continue;
      const key = `${unit.x},${unit.y}`;
      const stack = stacks.get(key) ?? 0;
      stacks.set(key, stack + 1);
      const px = unit.x * s + s / 2 + stack * 5;
      const py = unit.y * s + s / 2 + stack * 4;
      const color = FACTIONS[unit.factionId as FactionId].colors.main;
      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = color;
      ctx.strokeStyle = unit.id === selected ? '#ffffff' : '#0c1018';
      ctx.lineWidth = 2;
      if (unit.role === 'settler') {
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (unit.role === 'terraformer') {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeRect(-6, -6, 12, 12);
      } else if (unit.domain === 'sea') {
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(0, -7);
        ctx.lineTo(8, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(7, 6);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      if (unit.terraform) {
        ctx.strokeStyle = '#8fd18a';
        ctx.strokeRect(unit.x * s + 2, unit.y * s + 2, s - 4, s - 4);
      }
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number) {
    const mw = 168;
    const mh = 112;
    const x0 = 12;
    const y0 = height - mh - 12;
    ctx.fillStyle = 'rgba(8,12,20,0.86)';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = 'rgba(224,177,92,0.45)';
    ctx.strokeRect(x0, y0, mw, mh);
    const sx = mw / game.state.width;
    const sy = mh / game.state.height;
    for (let y = 0; y < game.state.height; y++) {
      for (let x = 0; x < game.state.width; x++) {
        if (!game.playerSees(x, y)) continue;
        const tile = game.tile(x, y);
        ctx.fillStyle = isSea(tile.terrain) ? '#1d4e63' : tile.zone === 'day' ? '#b86134' : tile.zone === 'night' ? '#8eabbf' : '#3f6b45';
        ctx.fillRect(x0 + x * sx, y0 + y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    ctx.fillStyle = 'rgba(224,177,92,0.9)';
    ctx.fillRect(x0 + CONFIG.map.bandStart * sx, y0, 1, mh);
    ctx.fillRect(x0 + (CONFIG.map.bandEnd + 1) * sx, y0, 1, mh);
  }

  private drawLegend(ctx: CanvasRenderingContext2D, width: number) {
    const items: [string, string][] = [
      ['#b86134', 'Day'],
      ['#6f8f86', 'Twilight'],
      ['#8eabbf', 'Night'],
    ];
    let x = width - 210;
    ctx.font = '12px Outfit, sans-serif';
    items.forEach(([color, label]) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, 12, 12, 12);
      ctx.fillStyle = '#e7edf6';
      ctx.fillText(label, x + 16, 22);
      x += 64;
    });
  }
}
