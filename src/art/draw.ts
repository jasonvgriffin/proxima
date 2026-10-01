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

function smooth(edge0: number, edge1: number, value: number) {
  const span = edge1 - edge0;
  if (span === 0) return value < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - edge0) / span));
  return t * t * (3 - 2 * t);
}

function fade(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = fade(x - x0);
  const sy = fade(y - y0);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number) {
  return valueNoise(x, y) * 0.56 + valueNoise(x * 2.05 + 5.2, y * 2.05 + 1.3) * 0.28 + valueNoise(x * 4.1 + 9.0, y * 4.1 + 4.7) * 0.16;
}

const planetSurfaces = new Map<number, HTMLCanvasElement>();
const cloudSheets = new Map<number, HTMLCanvasElement>();

function quantizeRadius(r: number) {
  return Math.max(24, Math.min(220, Math.round(r / 8) * 8));
}

/** Baked disc: scorched dayside, icy nightside, soft illumination terminator. No habitable stripe. */
function planetSurface(q: number) {
  const cached = planetSurfaces.get(q);
  if (cached) return cached;
  const size = q * 4;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const radius = size / 2;
  const lightX = -0.68;
  const lightY = -0.26;
  const lightZ = 0.68;
  const lightLen = Math.hypot(lightX, lightY, lightZ);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5) / radius - 1;
      const ny = (py + 0.5) / radius - 1;
      const r2 = nx * nx + ny * ny;
      const i = (py * size + px) * 4;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const ndotl = (nx * lightX + ny * lightY + nz * lightZ) / lightLen;
      const day = smooth(-0.12, 0.48, ndotl);
      const n = fbm(nx * 3.1 + 2.0, ny * 3.1 + 8.0);
      const ridge = fbm(nx * 7.4 + 1.2, ny * 7.4 + 3.4);
      const lava = day * smooth(0.58, 0.82, n) * (0.45 + ridge);
      let ar: number;
      let ag: number;
      let ab: number;
      if (day > 0.42) {
        ar = 92 + n * 48 + lava * 150;
        ag = 34 + n * 18 + lava * 55;
        ab = 18 + ridge * 12 + lava * 8;
      } else if (day > 0.12) {
        const rock = n * 40;
        ar = 62 + rock * (1 - day) * 0.3 + day * 40;
        ag = 40 + rock * 0.45;
        ab = 34 + rock * 0.35;
        ar = ar * (1 - day) + (110 + lava * 80) * day;
        ag = ag * (1 - day) + (48 + lava * 30) * day;
        ab = ab * (1 - day) + 22 * day;
      } else {
        const ice = 0.25 + n * 0.75;
        const crevasse = smooth(0.72, 0.9, ridge);
        ar = (16 + ice * 150) * (1 - crevasse * 0.85);
        ag = (24 + ice * 168) * (1 - crevasse * 0.85);
        ab = (38 + ice * 150) * (1 - crevasse * 0.7);
      }
      const lit = 0.2 + Math.max(0, ndotl) * 0.95;
      const limb = Math.pow(nz, 0.55);
      const shade = lit * (0.62 + 0.38 * limb);
      let rr = ar * shade + lava * 70;
      let gg = ag * shade + lava * 22;
      let bb = ab * shade;
      const glint = Math.pow(Math.max(0, ndotl), 6) * nz;
      rr += glint * 50;
      gg += glint * 24;
      bb += glint * 10;
      data[i] = rr < 0 ? 0 : rr > 255 ? 255 : rr;
      data[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      data[i + 2] = bb < 0 ? 0 : bb > 255 ? 255 : bb;
      data[i + 3] = r2 > 0.985 ? Math.round((1 - r2) / 0.015 * 255) : 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (planetSurfaces.size > 6) {
    const oldest = planetSurfaces.keys().next().value;
    if (oldest !== undefined) planetSurfaces.delete(oldest);
  }
  planetSurfaces.set(q, canvas);
  return canvas;
}

function cloudSheet(q: number) {
  const cached = cloudSheets.get(q);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = q * 4;
  canvas.height = q * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  for (let i = 0; i < 28; i++) {
    const cx = hash(i, 60) * canvas.width;
    const cy = hash(i, 61) * canvas.height;
    const rx = q * (0.18 + hash(i, 62) * 0.45);
    const ry = q * (0.035 + hash(i, 63) * 0.06);
    const g = ctx.createRadialGradient(cx, cy, ry * 0.2, cx, cy, rx);
    g.addColorStop(0, 'rgba(255,248,240,0.85)');
    g.addColorStop(0.45, 'rgba(255,236,220,0.35)');
    g.addColorStop(1, 'rgba(255,236,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (hash(i, 64) - 0.5) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cloudSheets.size > 6) {
    const oldest = cloudSheets.keys().next().value;
    if (oldest !== undefined) cloudSheets.delete(oldest);
  }
  cloudSheets.set(q, canvas);
  return canvas;
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save();
  const breathe = 0.92 + Math.sin(t * 1.3) * 0.05 + Math.sin(t * 0.31) * 0.04;
  const corona = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.6 * breathe);
  corona.addColorStop(0, 'rgba(255, 186, 120, 0.95)');
  corona.addColorStop(0.16, 'rgba(255, 78, 28, 0.55)');
  corona.addColorStop(0.38, 'rgba(176, 24, 32, 0.22)');
  corona.addColorStop(0.68, 'rgba(110, 12, 28, 0.08)');
  corona.addColorStop(1, 'rgba(80, 0, 16, 0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.6 * breathe, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y);
  for (let i = 0; i < 10; i++) {
    const ang = hash(i, 70) * Math.PI * 2 + t * 0.12;
    const len = r * (1.7 + hash(i, 71) * 1.5) * (0.85 + Math.sin(t * 1.6 + i) * 0.15);
    ctx.strokeStyle = `rgba(255, ${90 + (i % 3) * 30}, 48, ${0.06 + hash(i, 72) * 0.1})`;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r * 0.92, Math.sin(ang) * r * 0.92);
    ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const ang = hash(i, 80) * Math.PI * 2 + Math.sin(t * 0.4 + i) * 0.15;
    const life = 0.45 + Math.sin(t * 0.9 + i * 1.7) * 0.55;
    const reach = r * (0.55 + life * 1.35);
    ctx.save();
    ctx.rotate(ang);
    ctx.strokeStyle = `rgba(255, ${120 + life * 90}, 70, ${0.35 + life * 0.4})`;
    ctx.lineWidth = 1.5 + life * 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.82, 0);
    ctx.quadraticCurveTo(r + reach * 0.55, reach * 0.72, r * 0.55, reach * 0.08);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 70, 24, ${0.08 + life * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -3);
    ctx.quadraticCurveTo(r + reach * 0.85, reach * 0.45, r * 0.7, 5);
    ctx.fill();
    ctx.restore();
  }

  const burst = Math.pow(Math.max(0, Math.sin(t * 0.55)), 10);
  if (burst > 0.05) {
    ctx.rotate(t * 0.2);
    ctx.strokeStyle = `rgba(255, 220, 170, ${0.35 + burst * 0.5})`;
    ctx.lineWidth = 2 + burst * 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.7, 0);
    ctx.lineTo(r * (1.8 + burst * 2.4), r * 0.15);
    ctx.stroke();
    const flareGlow = ctx.createRadialGradient(r * 1.4, 0, 0, r * 1.4, 0, r * (0.8 + burst));
    flareGlow.addColorStop(0, `rgba(255, 160, 80, ${0.35 * burst})`);
    flareGlow.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = flareGlow;
    ctx.beginPath();
    ctx.arc(r * 1.3, 0, r * (0.8 + burst), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const body = ctx.createRadialGradient(x - r * 0.28, y - r * 0.3, r * 0.08, x, y, r);
  body.addColorStop(0, '#fff0d0');
  body.addColorStop(0.28, '#ffb15a');
  body.addColorStop(0.62, '#ff5418');
  body.addColorStop(1, '#9c140c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const ang = hash(i, 90) * Math.PI * 2 + t * 0.18;
    const dist = hash(i, 91) * r * 0.82;
    const gx = x + Math.cos(ang) * dist;
    const gy = y + Math.sin(ang) * dist;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 226, 180, 0.42)' : 'rgba(120, 18, 8, 0.28)';
    ctx.beginPath();
    ctx.arc(gx, gy, r * (0.05 + hash(i, 92) * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  if (r < 2) return;
  const q = quantizeRadius(r);
  ctx.save();
  const air = ctx.createRadialGradient(x - r * 0.2, y, r * 0.72, x, y, r * 1.22);
  air.addColorStop(0, 'rgba(255, 120, 60, 0)');
  air.addColorStop(0.62, 'rgba(255, 140, 80, 0.08)');
  air.addColorStop(0.82, 'rgba(255, 170, 120, 0.28)');
  air.addColorStop(1, 'rgba(255, 120, 70, 0)');
  ctx.fillStyle = air;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(planetSurface(q), x - r, y - r, r * 2, r * 2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.995, 0, Math.PI * 2);
  ctx.clip();
  const sheet = cloudSheet(q);
  const span = r * 2;
  const shift = ((t * 6) % span + span) % span
  ctx.globalAlpha = 0.42;
  ctx.drawImage(sheet, x - r - shift, y - r, span * 2, span);
  ctx.drawImage(sheet, x - r - shift + span * 2, y - r, span * 2, span);
  ctx.globalAlpha = 1;
  const nightVeil = ctx.createLinearGradient(x - r * 0.05, y, x + r * 0.95, y);
  nightVeil.addColorStop(0, 'rgba(8, 10, 16, 0)');
  nightVeil.addColorStop(0.58, 'rgba(8, 10, 16, 0)');
  nightVeil.addColorStop(1, 'rgba(6, 8, 14, 0.38)');
  ctx.fillStyle = nightVeil;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const spec = ctx.createRadialGradient(x - r * 0.42, y - r * 0.34, 0, x - r * 0.42, y - r * 0.34, r * 0.32);
  spec.addColorStop(0, 'rgba(255, 236, 214, 0.28)');
  spec.addColorStop(1, 'rgba(255, 236, 214, 0)');
  ctx.fillStyle = spec;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, r + Math.max(1.5, r * 0.035), 0, Math.PI * 2);
  ctx.arc(x + r * 0.14, y + r * 0.05, r * 0.97, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(255, 196, 150, 0.42)';
  ctx.fill('evenodd');

  ctx.beginPath();
  ctx.arc(x, y, r + Math.max(1, r * 0.02), 0, Math.PI * 2);
  ctx.arc(x - r * 0.1, y, r * 0.98, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(150, 186, 214, 0.16)';
  ctx.fill('evenodd');
  ctx.restore();
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
