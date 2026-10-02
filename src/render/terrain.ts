import { TERRAIN_PAINT, hash } from '../art/draw';
import { isSea } from '../core/rules';
import type { SpecialId, TerrainId, Tile } from '../core/types';

export const TILE_PX = 34;
export const CHUNK = 8;

const APRON = 1;

export function chunkCount(width: number, height: number): { cols: number; rows: number } {
  return { cols: Math.ceil(width / CHUNK), rows: Math.ceil(height / CHUNK) };
}

/** Minimap panel in pixels. The long edge stays put; the short edge follows the map. */
export function minimapPixels(mapWidth: number, mapHeight: number, maxWidth = 168): { width: number; height: number } {
  const width = maxWidth;
  const height = Math.max(1, Math.round((maxWidth * mapHeight) / Math.max(1, mapWidth)));
  return { width, height };
}

export function chunkHash(tiles: Tile[], width: number, height: number, cx: number, cy: number): string {
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  let h = 2166136261;
  for (let y = y0 - 1; y < y0 + CHUNK + 1; y++) {
    for (let x = x0 - 1; x < x0 + CHUNK + 1; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        h = Math.imul(h ^ 1, 16777619);
        continue;
      }
      const tile = tiles[y * width + x];
      h = mixHash(h, tile.terrain);
      h = Math.imul(h ^ Math.round((tile.elevation ?? 0) * 24), 16777619);
      h = Math.imul(h ^ Math.round((tile.rainfall ?? 0) * 8), 16777619);
      h = Math.imul(h ^ (tile.river ? 3 : 0), 16777619);
      h = Math.imul(h ^ (tile.scarred ? 7 : 0), 16777619);
      h = mixHash(h, tile.resource ?? '');
      h = mixHash(h, tile.special ?? '');
    }
  }
  return String(h >>> 0);
}

function mixHash(h: number, text: string): number {
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h;
}

export function paintChunk(
  tiles: Tile[],
  width: number,
  height: number,
  cx: number,
  cy: number,
  canvas: HTMLCanvasElement,
) {
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const tw = Math.min(CHUNK, width - x0);
  const th = Math.min(CHUNK, height - y0);
  canvas.width = Math.max(1, tw * TILE_PX);
  canvas.height = Math.max(1, th * TILE_PX);
  const src = document.createElement('canvas');
  src.width = (tw + APRON * 2) * TILE_PX;
  src.height = (th + APRON * 2) * TILE_PX;
  const sctx = src.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!sctx || !ctx) return;
  for (let ty = -APRON; ty < th + APRON; ty++) {
    for (let tx = -APRON; tx < tw + APRON; tx++) {
      const gx = x0 + tx;
      const gy = y0 + ty;
      const px = (tx + APRON) * TILE_PX;
      const py = (ty + APRON) * TILE_PX;
      const tile = gx >= 0 && gy >= 0 && gx < width && gy < height ? tiles[gy * width + gx] : null;
      const paint = tile ? (TERRAIN_PAINT[tile.terrain] ?? ['#333', '#222']) : ['#070910', '#070910'];
      sctx.fillStyle = paint[0];
      sctx.fillRect(px, py, TILE_PX, TILE_PX);
      if (!tile) continue;
      sctx.fillStyle = paint[1];
      const n = hash(gx, gy);
      sctx.globalAlpha = 0.35 + (n % 0.2);
      sctx.fillRect(px + (n * 10) % TILE_PX, py + ((n * 17) % 11), TILE_PX * 0.45, TILE_PX * 0.45);
      sctx.globalAlpha = 1;
      const left = sampleElevation(tiles, width, height, gx - 1, gy, tile.elevation);
      const up = sampleElevation(tiles, width, height, gx, gy - 1, tile.elevation);
      const light = (tile.elevation - left) * 1.15 + (tile.elevation - up) * 0.75;
      const alpha = Math.max(0, Math.min(0.5, Math.abs(light)));
      if (alpha > 0.02) {
        sctx.fillStyle = light > 0 ? `rgba(255, 236, 206, ${alpha})` : `rgba(12, 16, 28, ${alpha})`;
        sctx.fillRect(px, py, TILE_PX, TILE_PX);
      }
      if (tile.rainfall > 0.62 && !isSea(tile.terrain)) {
        sctx.fillStyle = `rgba(30, 80, 50, ${(tile.rainfall - 0.62) * 0.45})`;
        sctx.fillRect(px, py, TILE_PX, TILE_PX);
      } else if (tile.temperature > 0.72 && !isSea(tile.terrain)) {
        sctx.fillStyle = `rgba(170, 60, 20, ${(tile.temperature - 0.72) * 0.4})`;
        sctx.fillRect(px, py, TILE_PX, TILE_PX);
      } else if (tile.temperature < 0.28) {
        sctx.fillStyle = `rgba(190, 210, 230, ${(0.28 - tile.temperature) * 0.5})`;
        sctx.fillRect(px, py, TILE_PX, TILE_PX);
      }
    }
  }
  ctx.filter = 'blur(7px)';
  ctx.drawImage(src, -APRON * TILE_PX, -APRON * TILE_PX);
  ctx.filter = 'none';
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const gx = x0 + tx;
      const gy = y0 + ty;
      const tile = tiles[gy * width + gx];
      drawEdges(ctx, tiles, width, height, tile, tx, ty);
      drawMarks(ctx, tile, tx * TILE_PX, ty * TILE_PX);
    }
  }
}

function sampleElevation(tiles: Tile[], width: number, height: number, x: number, y: number, fallback: number): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return fallback;
  return tiles[y * width + x].elevation ?? fallback;
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  tiles: Tile[],
  width: number,
  height: number,
  tile: Tile,
  tx: number,
  ty: number,
) {
  const px = tx * TILE_PX;
  const py = ty * TILE_PX;
  const sea = isSea(tile.terrain);
  const around = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  if (!sea) {
    ctx.strokeStyle = 'rgba(226, 232, 220, 0.28)';
    ctx.lineWidth = 2;
    for (const [dx, dy] of around) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!isSea(tiles[ny * width + nx].terrain)) continue;
      ctx.beginPath();
      if (dx === 1) {
        ctx.moveTo(px + TILE_PX - 1, py + 2);
        ctx.lineTo(px + TILE_PX - 1, py + TILE_PX - 2);
      } else if (dx === -1) {
        ctx.moveTo(px + 1, py + 2);
        ctx.lineTo(px + 1, py + TILE_PX - 2);
      } else if (dy === 1) {
        ctx.moveTo(px + 2, py + TILE_PX - 1);
        ctx.lineTo(px + TILE_PX - 2, py + TILE_PX - 1);
      } else {
        ctx.moveTo(px + 2, py + 1);
        ctx.lineTo(px + TILE_PX - 2, py + 1);
      }
      ctx.stroke();
    }
  }
  if (tile.river) {
    ctx.strokeStyle = 'rgba(120, 196, 214, 0.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(px + TILE_PX * 0.5, py + TILE_PX * 0.5);
    const downhill = lowestNeighbor(tiles, width, height, tile);
    if (downhill) {
      ctx.lineTo(px + TILE_PX * (0.5 + downhill.dx * 0.5), py + TILE_PX * (0.5 + downhill.dy * 0.5));
    } else {
      ctx.lineTo(px + TILE_PX * 0.7, py + TILE_PX * 0.62);
    }
    ctx.stroke();
  }
}

function lowestNeighbor(
  tiles: Tile[],
  width: number,
  height: number,
  tile: Tile,
): { dx: number; dy: number } | null {
  let best: { dx: number; dy: number; elevation: number } | null = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = tiles[ny * width + nx];
      const elevation = isSea(next.terrain) ? -1 : next.elevation;
      if (!best || elevation < best.elevation) best = { dx, dy, elevation };
    }
  }
  if (!best || best.elevation >= tile.elevation) return null;
  return best;
}

function drawMarks(ctx: CanvasRenderingContext2D, tile: Tile, px: number, py: number) {
  const n = hash(tile.x, tile.y);
  for (let i = 0; i < 5; i++) {
    const sx = px + ((n * (i + 3) * 17) % (TILE_PX - 4));
    const sy = py + ((n * (i + 5) * 13) % (TILE_PX - 4));
    ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 2) * 0.03})`;
    ctx.fillRect(sx, sy, 2, 2);
  }
  if (tile.resource) drawResourceIcon(ctx, tile.resource, px + 6, py + TILE_PX - 12);
  if (tile.special) drawSpecialIcon(ctx, tile.special, px + TILE_PX - 14, py + 6);
  if (tile.scarred) {
    ctx.strokeStyle = 'rgba(210, 70, 60, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 8);
    ctx.lineTo(px + 14, py + 16);
    ctx.lineTo(px + TILE_PX - 8, py + TILE_PX - 6);
    ctx.stroke();
  }
}

function drawResourceIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  if (id === 'minerals') {
    ctx.fillStyle = '#e6d3ae';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(8, 4);
    ctx.lineTo(4, 8);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'nutrients') {
    ctx.fillStyle = '#8dce62';
    ctx.beginPath();
    ctx.ellipse(4, 4, 4, 2.4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'energy') {
    ctx.fillStyle = '#f0c45a';
    ctx.beginPath();
    ctx.arc(4, 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#d5dced';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(1, 1, 6, 6);
  }
  ctx.restore();
}

function drawSpecialIcon(ctx: CanvasRenderingContext2D, id: SpecialId, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  if (id === 'crystal') {
    ctx.fillStyle = '#9fd7ff';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(8, 6);
    ctx.lineTo(4, 10);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'spores') {
    ctx.fillStyle = '#c6e27a';
    ctx.beginPath();
    ctx.arc(2, 4, 2, 0, Math.PI * 2);
    ctx.arc(6, 3, 2.2, 0, Math.PI * 2);
    ctx.arc(4, 7, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'vent') {
    ctx.strokeStyle = '#ffb15a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1, 8);
    ctx.lineTo(4, 2);
    ctx.lineTo(7, 8);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#d8d2c4';
    ctx.fillRect(1, 2, 7, 6);
    ctx.strokeStyle = '#6d624f';
    ctx.strokeRect(1, 2, 7, 6);
  }
  ctx.restore();
}

/**
 * Improvement marks drawn over the terrain, after fog, so a remembered tile
 * can keep the works last seen there. `roads` bits are E=1, W=2, S=4, N=8.
 */
export function drawTileWorks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  improvement: string | null,
  road: boolean,
  roads: number,
  working: boolean,
) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (road) {
    ctx.strokeStyle = '#c4a46a';
    ctx.lineWidth = Math.max(2.6, size * 0.1);
    ctx.shadowColor = 'rgba(20, 12, 4, 0.7)';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    const reach = (bit: number) => ((roads & bit) !== 0 ? size * 0.48 : size * 0.2);
    ctx.moveTo(cx - reach(2), cy);
    ctx.lineTo(cx + reach(1), cy);
    ctx.moveTo(cx, cy - reach(8));
    ctx.lineTo(cx, cy + reach(4));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (improvement) {
    ctx.save();
    ctx.translate(cx, cy - (road ? size * 0.08 : 0));
    paintImprovement(ctx, improvement, size);
    ctx.restore();
  }
  if (working) {
    ctx.strokeStyle = 'rgba(232, 236, 220, 0.72)';
    ctx.lineWidth = 1.4;
    const inset = size * 0.16;
    const tick = size * 0.16;
    const corners = [
      [x + inset, y + inset, 1, 1],
      [x + size - inset, y + inset, -1, 1],
      [x + inset, y + size - inset, 1, -1],
      [x + size - inset, y + size - inset, -1, -1],
    ] as const;
    for (const [px, py, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(px, py + dy * tick);
      ctx.lineTo(px, py);
      ctx.lineTo(px + dx * tick, py);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintImprovement(ctx: CanvasRenderingContext2D, id: string, size: number) {
  const s = size * 0.34;
  if (id === 'farm') {
    ctx.strokeStyle = '#1a1408';
    ctx.fillStyle = '#d7e07a';
    ctx.lineWidth = 2.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-s, i * (s * 0.28));
      ctx.lineTo(s, i * (s * 0.28));
      ctx.stroke();
    }
    ctx.fillStyle = '#f2d36b';
    ctx.beginPath();
    ctx.arc(0, -s * 0.15, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'plant-trees') {
    const tree = (ox: number, oy: number, h: number) => {
      ctx.fillStyle = '#6a4a28';
      ctx.fillRect(ox - 1.2, oy, 2.4, h * 0.45);
      ctx.fillStyle = '#1f7a3a';
      ctx.beginPath();
      ctx.moveTo(ox, oy - h);
      ctx.lineTo(ox + h * 0.55, oy + 1);
      ctx.lineTo(ox - h * 0.55, oy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0c2414';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    tree(-s * 0.45, s * 0.15, s * 0.95);
    tree(s * 0.4, s * 0.28, s * 0.75);
    tree(0, s * 0.05, s * 1.15);
  } else if (id === 'mine') {
    ctx.fillStyle = '#241910';
    ctx.strokeStyle = '#e7d3ae';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.45);
    ctx.lineTo(0, -s * 0.15);
    ctx.lineTo(s * 0.7, s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f0e2c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.85);
    ctx.lineTo(s * 0.55, s * 0.05);
    ctx.moveTo(s * 0.55, s * 0.05);
    ctx.lineTo(s * 0.2, s * 0.15);
    ctx.stroke();
  } else if (id === 'solar') {
    ctx.fillStyle = '#10283c';
    ctx.strokeStyle = '#d7f4ff';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-s, -s * 0.55, s * 2, s * 1.15);
    ctx.strokeRect(-s, -s * 0.55, s * 2, s * 1.15);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(0, s * 0.6);
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.stroke();
    ctx.fillStyle = '#f2c14d';
    ctx.beginPath();
    ctx.arc(s * 0.85, -s * 0.85, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'atmosphere') {
    ctx.strokeStyle = '#d9fff0';
    ctx.fillStyle = 'rgba(170, 230, 200, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, s * 0.25, s * 0.9, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export function minimapColor(terrain: TerrainId): string {
  return TERRAIN_PAINT[terrain]?.[0] ?? '#333';
}
