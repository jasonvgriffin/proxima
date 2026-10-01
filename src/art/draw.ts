import type { FactionId } from '../core/types';
import { FACTIONS } from '../core/factions';
import { drawColonyArk, type ArkState } from './ark';
import { drawUnitSprite } from './units';

export function hash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#070910';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) {
    const x = (hash(i, 2) * w + t * (4 + (i % 5))) % w;
    const y = hash(i, 9) * h;
    ctx.globalAlpha = 0.25 + hash(i, 4) * 0.7;
    ctx.fillStyle = i % 7 === 0 ? '#e7c27a' : '#d5def0';
    ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
  glow.addColorStop(0, 'rgba(255, 186, 92, 0.95)');
  glow.addColorStop(0.4, 'rgba(196, 64, 36, 0.35)');
  glow.addColorStop(1, 'rgba(196, 64, 36, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd7a1';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,220,170,${0.3 + Math.sin(t) * 0.15})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.35 + Math.sin(t * 1.4) * 0.04), 0, Math.PI * 2);
  ctx.stroke();
}

export function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const day = ctx.createLinearGradient(x - r, y, x + r, y);
  day.addColorStop(0, '#c4552a');
  day.addColorStop(0.42, '#e39a55');
  day.addColorStop(0.5, '#6f8f86');
  day.addColorStop(0.58, '#24344a');
  day.addColorStop(1, '#121826');
  ctx.fillStyle = day;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 8; i++) {
    const cy = y - r + ((i * 37 + t * 12) % (r * 2));
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(80,40,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.2, cy, r * 0.7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = 'rgba(180, 160, 220, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(224, 177, 92, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.18, r, Math.sin(t * 0.2) * 0.1, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawArk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  tilt: number,
  broken: boolean | ArkState = false,
) {
  const state: ArkState = broken === true ? 'impact' : broken === false ? 'intact' : broken;
  const phase = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  drawColonyArk(ctx, x, y, scale, tilt, state, phase);
}

export function drawPod(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const phase = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35 + Math.sin(phase + x * 0.01) * 0.12);
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 8);
  ctx.lineTo(-4, 3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawUnitSprite(ctx, 0, 0, 26, { kind: 'colony', color, phase });
  ctx.restore();
}

export function drawEmblem(ctx: CanvasRenderingContext2D, faction: FactionId, x: number, y: number, size: number) {
  const colors = FACTIONS[faction].colors;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colors.ink;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.stroke();
  ctx.strokeStyle = colors.main;
  ctx.fillStyle = colors.main;
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.lineCap = 'round';
  if (faction === 'helm') {
    ctx.strokeRect(-size * 0.38, -size * 0.28, size * 0.76, size * 0.5);
    ctx.beginPath();
    ctx.moveTo(-size * 0.22, size * 0.02);
    ctx.lineTo(0, -size * 0.16);
    ctx.lineTo(size * 0.22, size * 0.02);
    ctx.stroke();
  } else if (faction === 'verdantia') {
    ctx.beginPath();
    ctx.ellipse(0, size * 0.05, size * 0.16, size * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-size * 0.18, -size * 0.02, size * 0.22, size * 0.12, -0.8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (faction === 'genesis') {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const p = i / 20;
      const px = Math.sin(p * Math.PI * 2) * size * 0.28;
      const py = (p - 0.5) * size * 0.7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const p = i / 20;
      const px = Math.sin(p * Math.PI * 2 + Math.PI) * size * 0.28;
      const py = (p - 0.5) * size * 0.7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (faction === 'ironclad') {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.42);
    ctx.lineTo(size * 0.36, -size * 0.1);
    ctx.lineTo(size * 0.24, size * 0.4);
    ctx.lineTo(-size * 0.24, size * 0.4);
    ctx.lineTo(-size * 0.36, -size * 0.1);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(-size * 0.22, -size * 0.02, size * 0.44, size * 0.08);
  } else if (faction === 'mnemosyne') {
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(-size * 0.15, 0, size * 0.16 * i, -0.8, 0.8);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.28, size * 0.08);
    ctx.lineTo(-size * 0.1, size * 0.08);
    ctx.lineTo(0, -size * 0.16);
    ctx.lineTo(size * 0.1, size * 0.2);
    ctx.lineTo(size * 0.22, size * 0.02);
    ctx.lineTo(size * 0.32, size * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

export const TERRAIN_PAINT: Record<string, [string, string]> = {
  grass: ['#3f6b45', '#2a4a30'],
  forest: ['#234a33', '#163424'],
  rocky: ['#6e6558', '#4c463f'],
  highlands: ['#5d6b4c', '#3c4a34'],
  ridge: ['#7c7468', '#534e46'],
  canyon: ['#8a5a3a', '#5a3824'],
  coast: ['#7d9174', '#c6b48a'],
  toxic: ['#5d6a30', '#3a421f'],
  'alien-growth': ['#3d6a58', '#214438'],
  scorched: ['#b86134', '#7a3c22'],
  dunes: ['#c48b48', '#8d5e30'],
  lava: ['#c23b2a', '#5c1a14'],
  'thin-air': ['#c6a27a', '#8d7356'],
  'frozen-plain': ['#c5d2df', '#7f95aa'],
  'ice-ridge': ['#e4eef6', '#8eabbf'],
  mountain: ['#9aa4ae', '#5d666e'],
  'hot-sea': ['#c85a38', '#8a2e28'],
  'temperate-sea': ['#2f7188', '#173f52'],
  'frozen-sea': ['#6d8da6', '#3c5a72'],
};
