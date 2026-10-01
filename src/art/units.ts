/**
 * Original procedural unit sprites. Silhouettes are drawn for a top-down
 * map token: readable at tile size, with faction-color trim.
 * Nothing here is traced from another game or a real vehicle.
 *
 * `unitKindFor` picks the silhouette. A transport that arrives later is
 * recognized by role "transport", chassis "transport", a special named
 * transport, or a unit name that contains "transport".
 */

export const UNIT_KINDS = [
  'colony',
  'terraformer',
  'walker',
  'infantry',
  'rover',
  'naval',
  'transport',
] as const;

export type UnitKind = (typeof UNIT_KINDS)[number];

export const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  colony: 'Colony Pod',
  terraformer: 'Terraformer',
  walker: 'Scout Walker',
  infantry: 'Infantry',
  rover: 'Rover',
  naval: 'Cutter',
  transport: 'Transport',
};

const KIND_SET = new Set<string>(UNIT_KINDS);

export interface UnitSpriteSpec {
  kind?: UnitKind | string;
  role?: string;
  domain?: string;
  chassis?: string | null;
  specials?: readonly string[] | null;
  name?: string;
  color: string;
  deep?: string;
  phase?: number;
  selected?: boolean;
  hp?: number;
  maxHp?: number;
  stack?: number;
  working?: boolean;
}

export function unitKindFor(spec: {
  kind?: string;
  role?: string;
  domain?: string;
  chassis?: string | null;
  specials?: readonly string[] | null;
  name?: string;
}): UnitKind {
  if (spec.kind && KIND_SET.has(spec.kind)) return spec.kind as UnitKind;
  const chassis = (spec.chassis ?? '').toLowerCase();
  const role = (spec.role ?? '').toLowerCase();
  const name = (spec.name ?? '').toLowerCase();
  const specials = (spec.specials ?? []).map((id) => id.toLowerCase());
  const transport =
    chassis === 'transport' ||
    chassis === 'barge' ||
    role === 'transport' ||
    specials.includes('transport') ||
    name.includes('transport');
  if (transport) return 'transport';
  if (chassis === 'colony' || role === 'settler') return 'colony';
  if (chassis === 'former' || role === 'terraformer') return 'terraformer';
  if (chassis === 'walker' || role === 'scout') return 'walker';
  if (chassis === 'rover') return 'rover';
  if (chassis === 'hull' || spec.domain === 'sea' || role === 'naval') return 'naval';
  return 'infantry';
}

interface Ink {
  trim: string;
  deep: string;
  line: string;
  selected: boolean;
}

function inkOf(spec: UnitSpriteSpec): Ink {
  return {
    trim: spec.color,
    deep: spec.deep || '#1b2433',
    line: spec.selected ? '#ffffff' : '#121820',
    selected: !!spec.selected,
  };
}

function stroke(ctx: CanvasRenderingContext2D, ink: Ink, width = 1.7) {
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = ink.selected ? width + 0.7 : width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Draw a unit centered on x, y. `size` is the sprite height in pixels. */
export function drawUnitSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  spec: UnitSpriteSpec,
): void {
  const kind = unitKindFor(spec);
  const phase = spec.phase ?? 0;
  const ink = inkOf(spec);
  const bob =
    kind === 'colony'
      ? Math.sin(phase * 2.4) * 1.15
      : kind === 'naval' || kind === 'transport'
        ? Math.sin(phase * 1.6) * 0.75
        : kind === 'walker' || kind === 'infantry'
          ? -Math.abs(Math.sin(phase * 4)) * 0.55
          : Math.sin(phase * 1.8) * 0.3;

  ctx.save();
  ctx.translate(x, y + bob);
  if (spec.selected) {
    ctx.beginPath();
    ctx.ellipse(0, size * 0.06, size * 0.58, size * 0.44, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(1.5, size * 0.055);
    ctx.stroke();
  }
  ctx.save();
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 12, kind === 'transport' ? 14 : 10, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'colony') drawColony(ctx, ink, phase);
  else if (kind === 'terraformer') drawTerraformer(ctx, ink, phase, !!spec.working);
  else if (kind === 'walker') drawWalker(ctx, ink, phase);
  else if (kind === 'rover') drawRover(ctx, ink, phase);
  else if (kind === 'naval') drawNaval(ctx, ink, phase);
  else if (kind === 'transport') drawTransport(ctx, ink, phase);
  else drawInfantry(ctx, ink, phase);
  ctx.restore();

  if (spec.maxHp != null && spec.maxHp > 0) {
    drawHealth(ctx, size, spec.hp ?? spec.maxHp, spec.maxHp);
  }
  if (spec.stack != null && spec.stack > 1) drawStack(ctx, size, spec.stack);
  ctx.restore();
}

function drawHealth(ctx: CanvasRenderingContext2D, size: number, hp: number, maxHp: number) {
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const w = Math.max(14, size * 0.9);
  const h = Math.max(3, size * 0.1);
  const y = size * 0.56;
  ctx.fillStyle = 'rgba(8,10,16,0.9)';
  ctx.fillRect(-w / 2 - 1, y, w + 2, h + 2);
  ctx.fillStyle = ratio > 0.66 ? '#7dce7a' : ratio > 0.33 ? '#e0b15c' : '#e15d4f';
  ctx.fillRect(-w / 2, y + 1, Math.max(0, w * ratio), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 - 1, y, w + 2, h + 2);
}

function drawStack(ctx: CanvasRenderingContext2D, size: number, count: number) {
  const bx = size * 0.46;
  const by = -size * 0.46;
  const r = Math.max(6.5, size * 0.24);
  ctx.beginPath();
  ctx.fillStyle = '#0c1018';
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#f4f7fb';
  ctx.stroke();
  ctx.fillStyle = '#f4f7fb';
  ctx.font = `700 ${Math.max(9, r * 1.15)}px Outfit, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), bx, by + 0.5);
}

function band(ctx: CanvasRenderingContext2D, ink: Ink, y: number, h: number) {
  ctx.save();
  ctx.clip();
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-16, y, 32, h);
  ctx.fillStyle = ink.deep;
  ctx.fillRect(-16, y + h - 1, 32, 1);
  ctx.restore();
}

function drawColony(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  const glow = 0.45 + Math.sin(phase * 6) * 0.25;
  ctx.fillStyle = `rgba(255, 170, 80, ${glow})`;
  ctx.beginPath();
  ctx.ellipse(0, 10, 4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8b97a6';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.lineTo(-9, 12);
  ctx.moveTo(0, 7);
  ctx.lineTo(0, 12);
  ctx.moveTo(6, 6);
  ctx.lineTo(9, 12);
  ctx.stroke();
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-11, 12);
  ctx.lineTo(-6, 12);
  ctx.moveTo(-2, 12);
  ctx.lineTo(2, 12);
  ctx.moveTo(6, 12);
  ctx.lineTo(11, 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(9, -13, 10, -2, 7, 6);
  ctx.bezierCurveTo(4, 10, -4, 10, -7, 6);
  ctx.bezierCurveTo(-10, -2, -9, -13, 0, -14);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -14, 0, 10);
  body.addColorStop(0, '#f4f7fb');
  body.addColorStop(0.45, '#c5ced8');
  body.addColorStop(1, '#6a7684');
  ctx.fillStyle = body;
  ctx.fill();
  stroke(ctx, ink, 1.8);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(9, -13, 10, -2, 7, 6);
  ctx.bezierCurveTo(4, 10, -4, 10, -7, 6);
  ctx.bezierCurveTo(-10, -2, -9, -13, 0, -14);
  ctx.clip();
  band(ctx, ink, 2, 3.4);
  ctx.fillStyle = 'rgba(255, 220, 180, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-2, -8, 4, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#123846';
  ctx.beginPath();
  ctx.ellipse(0, -4, 3.6, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c6eef8';
  ctx.beginPath();
  ctx.ellipse(-0.6, -5, 1.6, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -4, 3.6, 4.4, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#3c4654';
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(10, -4);
  ctx.lineTo(6, 0);
  ctx.closePath();
  ctx.fill();
}

function drawWalker(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  const step = Math.sin(phase * 4);
  leg(ctx, -1, step, ink);
  leg(ctx, 1, -step, ink);

  ctx.fillStyle = '#8b97a6';
  ctx.beginPath();
  ctx.moveTo(-6, -1);
  ctx.lineTo(6, -1);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, ink, 1.5);
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-3.2, 0.2, 6.4, 2.2);

  ctx.fillStyle = '#d5dde6';
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(4, -8);
  ctx.lineTo(3, -2);
  ctx.lineTo(-3, -2);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, ink, 1.5);
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-2.2, -6.2, 4.4, 1.6);
  ctx.fillStyle = '#e9f6fb';
  ctx.fillRect(-1.2, -5.6, 1.2, 0.8);

  ctx.strokeStyle = '#c5ced8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(2, -8);
  ctx.lineTo(5, -15);
  ctx.stroke();
  ctx.fillStyle = ink.trim;
  ctx.globalAlpha = 0.55 + Math.sin(phase * 5) * 0.4;
  ctx.beginPath();
  ctx.arc(5, -15, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#2c3542';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(4, -3);
  ctx.lineTo(13, 1);
  ctx.stroke();
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, 0.2);
  ctx.lineTo(14, 1.6);
  ctx.stroke();
}

function leg(ctx: CanvasRenderingContext2D, side: number, step: number, ink: Ink) {
  ctx.strokeStyle = '#5d6a78';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(side * 3, 3);
  ctx.lineTo(side * 3 + step * 4, 8);
  ctx.lineTo(side * 4 + step * 6, 13);
  ctx.stroke();
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(side * 2 + step * 6, 13);
  ctx.lineTo(side * 7 + step * 6, 13);
  ctx.stroke();
}

function drawTerraformer(ctx: CanvasRenderingContext2D, ink: Ink, phase: number, working: boolean) {
  const spin = phase * (working ? 9 : 1.4);
  ctx.fillStyle = '#2c3542';
  round(ctx, -11, 5, 22, 6, 2);
  ctx.fill();
  ctx.strokeStyle = '#121820';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  const tread = (spin * 4) % 4;
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 1.2;
  for (let i = -9; i <= 9; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i + tread, 6);
    ctx.lineTo(i + tread - 1.5, 10);
    ctx.stroke();
  }

  ctx.fillStyle = '#9aa6b4';
  round(ctx, -10, -3, 20, 9, 2);
  ctx.fill();
  stroke(ctx, ink, 1.6);
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-8, 0, 16, 2.4);

  ctx.fillStyle = '#d5dde6';
  round(ctx, -2, -9, 8, 7, 1.5);
  ctx.fill();
  stroke(ctx, ink, 1.4);
  ctx.fillStyle = '#9fd8e8';
  ctx.fillRect(-0.5, -7.5, 5, 3.2);

  ctx.strokeStyle = '#5d6a78';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-13, 3 + Math.sin(spin) * 0.8);
  ctx.stroke();
  ctx.save();
  ctx.translate(12, 1);
  ctx.rotate(spin);
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 3);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#6a7684';
  ctx.fillRect(4, -7, 5, 4);
  ctx.strokeStyle = ink.line;
  ctx.strokeRect(4, -7, 5, 4);

  if (working) {
    ctx.fillStyle = 'rgba(180, 160, 120, 0.45)';
    ctx.beginPath();
    ctx.ellipse(12, 8, 4 + Math.sin(phase * 8) * 1.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawInfantry(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  const step = Math.sin(phase * 4);
  ctx.strokeStyle = '#3c4654';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-3 - step * 2, 11);
  ctx.moveTo(2, 2);
  ctx.lineTo(3 + step * 2, 11);
  ctx.stroke();
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5 - step * 2, 11);
  ctx.lineTo(-1 - step * 2, 11);
  ctx.moveTo(1 + step * 2, 11);
  ctx.lineTo(5 + step * 2, 11);
  ctx.stroke();

  ctx.fillStyle = '#8b97a6';
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(4, -4);
  ctx.lineTo(5, 3);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, ink, 1.5);
  ctx.fillStyle = ink.trim;
  ctx.beginPath();
  ctx.arc(-4, -3, 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5d6a78';
  ctx.fillRect(-6, -2, 3, 4);

  ctx.fillStyle = '#d7c2a4';
  ctx.beginPath();
  ctx.arc(0, -7, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c3542';
  ctx.beginPath();
  ctx.arc(0, -8.2, 3.8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-2.4, -7.2, 4.8, 1.5);

  ctx.strokeStyle = '#2c3542';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(3, -1);
  ctx.lineTo(12, 2);
  ctx.stroke();
  ctx.fillStyle = '#1b2430';
  ctx.fillRect(10.5, 1, 3, 2);
}

function drawRover(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  wheel(ctx, -7, 6, phase, ink);
  wheel(ctx, 7, 6, phase, ink);

  ctx.fillStyle = '#9aa6b4';
  round(ctx, -11, -3, 22, 8, 2);
  ctx.fill();
  stroke(ctx, ink, 1.6);
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-9, 0, 18, 2.2);

  ctx.fillStyle = '#d5dde6';
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(6, -3);
  ctx.lineTo(8, -9);
  ctx.lineTo(-1, -9);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, ink, 1.4);
  ctx.fillStyle = '#9fd8e8';
  ctx.beginPath();
  ctx.moveTo(-1, -4);
  ctx.lineTo(5, -4);
  ctx.lineTo(6.5, -8);
  ctx.lineTo(0.2, -8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#c5ced8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(8, -14);
  ctx.stroke();
  ctx.fillStyle = ink.trim;
  ctx.beginPath();
  ctx.arc(8, -14, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, ink: Ink) {
  ctx.beginPath();
  ctx.fillStyle = '#1c2430';
  ctx.arc(x, y, 4.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = ink.line;
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(phase * 5);
  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-2.6, 0);
  ctx.lineTo(2.6, 0);
  ctx.moveTo(0, -2.6);
  ctx.lineTo(0, 2.6);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.fillStyle = '#e7edf4';
  ctx.arc(x, y, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawNaval(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  const wake = (phase * 6) % 5;
  ctx.strokeStyle = 'rgba(186, 220, 232, 0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 - i * 4 - wake, 4 + i * 2);
    ctx.lineTo(-16 - i * 3 - wake, 5 + i * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-12, 5);
  ctx.lineTo(-8, -4);
  ctx.quadraticCurveTo(2, -7, 12, -2);
  ctx.lineTo(16, 1);
  ctx.quadraticCurveTo(4, 7, -12, 5);
  ctx.closePath();
  const hull = ctx.createLinearGradient(0, -7, 0, 7);
  hull.addColorStop(0, '#e7eef6');
  hull.addColorStop(0.5, '#8b9aab');
  hull.addColorStop(1, '#3e4c5c');
  ctx.fillStyle = hull;
  ctx.fill();
  stroke(ctx, ink, 1.6);
  ctx.fillStyle = ink.trim;
  ctx.beginPath();
  ctx.moveTo(-8, 1);
  ctx.lineTo(10, -1);
  ctx.lineTo(10, 1.2);
  ctx.lineTo(-8, 3.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#d5dde6';
  round(ctx, -2, -8, 7, 5, 1);
  ctx.fill();
  stroke(ctx, ink, 1.3);
  ctx.fillStyle = '#9fd8e8';
  ctx.fillRect(-0.4, -6.6, 4, 2);

  ctx.strokeStyle = '#c5ced8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, -8);
  ctx.lineTo(2, -14);
  ctx.stroke();
  ctx.fillStyle = ink.trim;
  ctx.beginPath();
  ctx.moveTo(2, -14);
  ctx.lineTo(8, -12);
  ctx.lineTo(2, -11);
  ctx.closePath();
  ctx.fill();
}

function drawTransport(ctx: CanvasRenderingContext2D, ink: Ink, phase: number) {
  const wake = (phase * 4) % 4;
  ctx.strokeStyle = 'rgba(186, 220, 232, 0.45)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-12 - wake, 7);
  ctx.lineTo(-18 - wake, 8);
  ctx.moveTo(-10 - wake, 9);
  ctx.lineTo(-16 - wake, 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-15, 6);
  ctx.lineTo(-15, -3);
  ctx.lineTo(8, -5);
  ctx.lineTo(14, -1);
  ctx.lineTo(12, 7);
  ctx.closePath();
  const hull = ctx.createLinearGradient(0, -6, 0, 8);
  hull.addColorStop(0, '#e4ebf3');
  hull.addColorStop(0.55, '#7f8e9f');
  hull.addColorStop(1, '#364454');
  ctx.fillStyle = hull;
  ctx.fill();
  stroke(ctx, ink, 1.7);

  ctx.fillStyle = '#121820';
  round(ctx, -6, -2, 10, 6, 1);
  ctx.fill();
  ctx.fillStyle = '#c5ced8';
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.bezierCurveTo(-2, -2, 0, -3, 1, 0);
  ctx.bezierCurveTo(0, 2, -2, 3, -3, 1);
  ctx.fill();
  ctx.fillStyle = '#9fd8e8';
  ctx.beginPath();
  ctx.ellipse(-1, -0.2, 0.8, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(-7, -9);
  ctx.lineTo(5, -9);
  ctx.lineTo(5, -2);
  ctx.stroke();
  ctx.strokeStyle = '#c5ced8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-1, -9);
  ctx.lineTo(-1, -2);
  ctx.stroke();

  ctx.fillStyle = '#6a7684';
  round(ctx, 6, -8, 6, 6, 1);
  ctx.fill();
  stroke(ctx, ink, 1.3);
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-12, 2, 18, 2);
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function unitIconTag(opts: {
  kind?: string;
  role?: string;
  domain?: string;
  chassis?: string | null;
  specials?: readonly string[] | null;
  name?: string;
  color: string;
  deep?: string;
  hp?: number;
  maxHp?: number;
  selected?: boolean;
  stack?: number;
  working?: boolean;
  large?: boolean;
  phase?: number;
}): string {
  const kind = unitKindFor(opts);
  const width = opts.large ? 296 : 104;
  const height = opts.large ? 208 : 80;
  const attrs = [
    `class="${opts.large ? 'unit-icon lg' : 'unit-icon'}"`,
    'data-unit-icon',
    `data-kind="${kind}"`,
    `data-color="${opts.color}"`,
    `data-deep="${opts.deep ?? ''}"`,
    `width="${width}"`,
    `height="${height}"`,
  ];
  if (opts.hp != null) attrs.push(`data-hp="${opts.hp}"`);
  if (opts.maxHp != null) attrs.push(`data-max-hp="${opts.maxHp}"`);
  if (opts.selected) attrs.push('data-selected="1"');
  if (opts.stack != null && opts.stack > 1) attrs.push(`data-stack="${opts.stack}"`);
  if (opts.working) attrs.push('data-working="1"');
  if (opts.phase != null) attrs.push(`data-phase="${opts.phase}"`);
  return `<canvas ${attrs.join(' ')}></canvas>`;
}

/** Paint a canvas that carries data-kind / data-color attributes. */
export function paintUnitIcon(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const cssW = canvas.clientWidth || Number(canvas.getAttribute('width')) || 64;
  const cssH = canvas.clientHeight || Number(canvas.getAttribute('height')) || 48;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const kind = unitKindFor({
    kind: canvas.dataset.kind,
    role: canvas.dataset.role,
    domain: canvas.dataset.domain,
    chassis: canvas.dataset.chassis,
    name: canvas.dataset.name,
  });
  drawUnitSprite(ctx, cssW / 2, cssH / 2 + cssH * 0.04, Math.min(cssW, cssH) * 0.78, {
    kind,
    color: canvas.dataset.color || '#e4d2a8',
    deep: canvas.dataset.deep,
    phase: canvas.dataset.phase ? Number(canvas.dataset.phase) : 0.9,
    selected: canvas.dataset.selected === '1',
    hp: canvas.dataset.hp ? Number(canvas.dataset.hp) : undefined,
    maxHp: canvas.dataset.maxHp ? Number(canvas.dataset.maxHp) : undefined,
    stack: canvas.dataset.stack ? Number(canvas.dataset.stack) : undefined,
    working: canvas.dataset.working === '1',
  });
}
