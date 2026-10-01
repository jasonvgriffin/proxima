/**
 * Original procedural colony ark. A spinal colony ship: engine cluster,
 * habitat modules, a pod bay, radiators, and a command nose.
 * Star light comes from the upper left. Impact and breakup are separate states.
 */

export type ArkState = 'intact' | 'impact' | 'breakup';

export function arkStateFrom(broken: boolean | ArkState): ArkState {
  if (broken === true) return 'impact';
  if (broken === false) return 'intact';
  return broken;
}

export function drawColonyArk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  tilt: number,
  state: ArkState,
  phase = 0,
): void {
  const breakup = state === 'breakup';
  const impact = state === 'impact';
  const split = breakup ? 18 + Math.sin(phase * 0.8) * 3 : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);

  ctx.save();
  ctx.translate(-split, breakup ? 5 : 0);
  ctx.rotate(breakup ? -0.14 : 0);
  drawEngines(ctx, phase, impact || breakup);
  drawAftBlock(ctx, impact);
  ctx.restore();

  ctx.save();
  ctx.translate(0, breakup ? 8 : 0);
  drawKeel(ctx, -36, breakup ? 8 : 62);
  drawRadiator(ctx, -1, false);
  drawRadiator(ctx, 1, impact);
  drawHabitat(ctx, -40, -16, 36, 32, impact);
  drawPodBay(ctx, 0, breakup, impact);
  if (!breakup) drawHabitat(ctx, 26, -14, 32, 28, false);
  if (impact) burn(ctx, -22, -2, phase);
  ctx.restore();

  ctx.save();
  ctx.translate(split * 1.35, breakup ? -8 : 0);
  ctx.rotate(breakup ? 0.2 : 0);
  if (breakup) {
    drawKeel(ctx, 18, 58);
    drawHabitat(ctx, 22, -14, 32, 28, true);
  }
  drawNose(ctx, impact || breakup);
  ctx.restore();

  if (impact) drawSmoke(ctx, phase);
  if (breakup) drawDebris(ctx, phase);
  ctx.restore();
}

function hullPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function paintHull(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  windowY: number | null,
) {
  hullPath(ctx, x, y, w, h, r);
  const metal = ctx.createLinearGradient(x, y, x, y + h);
  metal.addColorStop(0, '#f5f8fc');
  metal.addColorStop(0.28, '#d0dae6');
  metal.addColorStop(0.62, '#8493a6');
  metal.addColorStop(1, '#3a4656');
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.save();
  hullPath(ctx, x, y, w, h, r);
  ctx.clip();
  const sun = ctx.createLinearGradient(x, y, x + w, y + h);
  sun.addColorStop(0, 'rgba(255, 214, 170, 0.5)');
  sun.addColorStop(0.42, 'rgba(255, 214, 170, 0)');
  sun.addColorStop(1, 'rgba(8, 12, 20, 0.32)');
  ctx.fillStyle = sun;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(18, 26, 38, 0.28)';
  ctx.lineWidth = 1;
  for (let px = x + 7; px < x + w - 3; px += 8) {
    ctx.beginPath();
    ctx.moveTo(px, y + 3);
    ctx.lineTo(px, y + h - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(18, 26, 38, 0.2)';
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h * 0.5);
  ctx.lineTo(x + w - 3, y + h * 0.5);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#1a2230';
  ctx.lineWidth = 1.5;
  hullPath(ctx, x, y, w, h, r);
  ctx.stroke();
  if (windowY != null) {
    const count = Math.max(3, Math.floor((w - 10) / 8));
    for (let i = 0; i < count; i++) {
      const wx = x + 6 + i * ((w - 12) / count);
      ctx.fillStyle = '#0c2230';
      ctx.fillRect(wx, windowY, 3.4, 5.2);
      ctx.fillStyle = 'rgba(190, 236, 250, 0.92)';
      ctx.fillRect(wx + 0.7, windowY + 0.8, 1.5, 2.2);
    }
  }
}

function drawEngines(ctx: CanvasRenderingContext2D, phase: number, damaged: boolean) {
  const bells = [-12, 0, 12];
  bells.forEach((ey, index) => {
    const alive = !(damaged && index === 1);
    const flicker = alive ? 0.72 + Math.sin(phase * 16 + index) * 0.28 : 0;
    if (alive) {
      const glow = ctx.createRadialGradient(-102, ey, 2, -102, ey, 30);
      glow.addColorStop(0, `rgba(255, 244, 220, ${0.95 * flicker})`);
      glow.addColorStop(0.28, `rgba(255, 150, 70, ${0.7 * flicker})`);
      glow.addColorStop(0.6, `rgba(180, 60, 24, ${0.28 * flicker})`);
      glow.addColorStop(1, 'rgba(180, 40, 16, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(-108, ey, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-72, ey - 4.5);
    ctx.lineTo(-90, ey - 8);
    ctx.lineTo(-90, ey + 8);
    ctx.lineTo(-72, ey + 4.5);
    ctx.closePath();
    const bell = ctx.createLinearGradient(-90, ey - 8, -72, ey + 8);
    bell.addColorStop(0, alive ? '#d5dee8' : '#6a5348');
    bell.addColorStop(1, alive ? '#6c7c8e' : '#3a2a28');
    ctx.fillStyle = bell;
    ctx.fill();
    ctx.strokeStyle = '#1a2230';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-86, ey - 5);
    ctx.lineTo(-76, ey - 3);
    ctx.stroke();
    if (alive) {
      ctx.fillStyle = `rgba(255, 228, 190, ${flicker})`;
      ctx.fillRect(-91, ey - 3, 3, 6);
    } else {
      ctx.strokeStyle = '#e15d4f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-86, ey - 4);
      ctx.lineTo(-78, ey + 4);
      ctx.moveTo(-78, ey - 4);
      ctx.lineTo(-86, ey + 4);
      ctx.stroke();
    }
  });
}

function drawAftBlock(ctx: CanvasRenderingContext2D, impact: boolean) {
  paintHull(ctx, -72, -16, 30, 32, 4, -2);
  ctx.fillStyle = '#243140';
  ctx.fillRect(-68, -6, 8, 12);
  ctx.fillStyle = '#9aa8b8';
  ctx.fillRect(-50, -3, 10, 6);
  if (impact) {
    ctx.strokeStyle = 'rgba(40, 24, 18, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-66, -8);
    ctx.lineTo(-48, 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0b15c';
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-60, -14, 2, 2);
  ctx.fillRect(-54, 12, 2, 2);
  ctx.globalAlpha = 1;
}

function drawKeel(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  ctx.fillStyle = '#5e6e80';
  ctx.fillRect(x0, -2.5, x1 - x0, 5);
  ctx.strokeStyle = '#243040';
  ctx.lineWidth = 1;
  for (let x = x0; x < x1 - 6; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.lineTo(x + 8, 8);
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 8, -8);
    ctx.stroke();
  }
}

function drawRadiator(ctx: CanvasRenderingContext2D, sign: number, broken: boolean) {
  ctx.save();
  const y = sign * 22;
  if (broken) {
    ctx.translate(20, y);
    ctx.rotate(sign * 0.55);
    ctx.translate(-20, -y);
  }
  ctx.beginPath();
  ctx.moveTo(-20, y);
  ctx.lineTo(48, y - sign * 8);
  ctx.lineTo(70, y - sign * 2);
  ctx.lineTo(48, y + sign * 6);
  ctx.closePath();
  const fin = ctx.createLinearGradient(-20, y - 10, 70, y + 10);
  fin.addColorStop(0, '#b7c6d6');
  fin.addColorStop(1, '#4d6074');
  ctx.fillStyle = fin;
  ctx.fill();
  ctx.strokeStyle = '#1c2836';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 176, 90, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, y - sign * 1);
  ctx.lineTo(58, y - sign * 3);
  ctx.stroke();
  if (broken) {
    ctx.strokeStyle = '#1a2230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, y - 6);
    ctx.lineTo(46, y + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHabitat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scar: boolean) {
  paintHull(ctx, x, y, w, h, 8, y + h * 0.42);
  ctx.fillStyle = '#c23b2a';
  ctx.fillRect(x + w - 6, y + 4, 3, 3);
  ctx.fillStyle = '#e0b15c';
  ctx.fillRect(x + 4, y + 4, 3, 3);
  if (scar) {
    ctx.strokeStyle = 'rgba(30, 18, 14, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 8);
    ctx.lineTo(x + w - 8, y + h - 6);
    ctx.moveTo(x + w * 0.5, y + 5);
    ctx.lineTo(x + 8, y + h - 5);
    ctx.stroke();
  }
}

function drawPodBay(ctx: CanvasRenderingContext2D, x: number, open: boolean, scorched: boolean) {
  paintHull(ctx, x, -18, 24, 36, 5, null);
  ctx.fillStyle = open ? '#140c0c' : '#1a2433';
  roundLocal(ctx, x + 4, -8, 16, 16, 2);
  ctx.fill();
  if (!open) {
    const colors = ['#e4d2a8', '#8fd18a', '#e15a4c', '#8eb6ff'];
    colors.forEach((color, i) => {
      const px = x + 7 + (i % 2) * 8;
      const py = -5 + Math.floor(i / 2) * 8;
      ctx.fillStyle = '#c5ced8';
      ctx.beginPath();
      ctx.ellipse(px, py, 2.4, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(px - 2, py, 4, 1.3);
    });
  } else {
    ctx.strokeStyle = '#9aa8b8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 4, -8);
    ctx.lineTo(x - 2, -14);
    ctx.moveTo(x + 20, -8);
    ctx.lineTo(x + 28, -14);
    ctx.stroke();
  }
  if (scorched) {
    ctx.fillStyle = 'rgba(90, 30, 16, 0.45)';
    ctx.fillRect(x + 2, 8, 20, 8);
  }
}

function drawNose(ctx: CanvasRenderingContext2D, damaged: boolean) {
  ctx.beginPath();
  ctx.moveTo(52, -12);
  ctx.quadraticCurveTo(92, -16, 114, 0);
  ctx.quadraticCurveTo(92, 14, 52, 12);
  ctx.closePath();
  const metal = ctx.createLinearGradient(52, -16, 52, 14);
  metal.addColorStop(0, '#f7fbff');
  metal.addColorStop(0.4, '#c5d0dc');
  metal.addColorStop(1, '#465468');
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const sun = ctx.createLinearGradient(60, -16, 100, 10);
  sun.addColorStop(0, 'rgba(255, 220, 180, 0.55)');
  sun.addColorStop(0.5, 'rgba(255, 220, 180, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(52, -16, 64, 32);
  ctx.restore();
  ctx.strokeStyle = '#1a2230';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(52, -12);
  ctx.quadraticCurveTo(92, -16, 114, 0);
  ctx.quadraticCurveTo(92, 14, 52, 12);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#0e3144';
  ctx.beginPath();
  ctx.ellipse(88, -1, 10, 4.2, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b7e6f4';
  ctx.beginPath();
  ctx.ellipse(86, -2, 4, 2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d5deea';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(74, -16, 6, 0.15, Math.PI - 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(74, -16);
  ctx.lineTo(74, -10);
  ctx.stroke();

  ctx.fillStyle = damaged ? '#5a4038' : '#e0b15c';
  ctx.beginPath();
  ctx.arc(108, -2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  if (damaged) {
    ctx.strokeStyle = '#e15d4f';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(96, -8);
    ctx.lineTo(108, 4);
    ctx.moveTo(100, 6);
    ctx.lineTo(90, -2);
    ctx.stroke();
  }
}

function burn(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number) {
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 8);
  ctx.lineTo(x + 8, y - 3);
  ctx.lineTo(x + 5, y + 6);
  ctx.lineTo(x - 4, y + 8);
  ctx.lineTo(x - 9, y + 1);
  ctx.closePath();
  const fire = ctx.createRadialGradient(x, y, 1, x, y, 14);
  fire.addColorStop(0, '#fff4cc');
  fire.addColorStop(0.35, '#ff7a2a');
  fire.addColorStop(1, '#5c140e');
  ctx.fillStyle = fire;
  ctx.fill();
  ctx.globalAlpha = 0.65 + Math.sin(phase * 14) * 0.3;
  ctx.fillStyle = '#ffe1a0';
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 2.4, 6 + Math.sin(phase * 11) * 1.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSmoke(ctx: CanvasRenderingContext2D, phase: number) {
  const puffs: [number, number, number][] = [
    [-10, -28, 10],
    [6, -36, 14],
    [18, -24, 8],
  ];
  puffs.forEach(([x, y, r], i) => {
    ctx.globalAlpha = 0.22 + (i % 2) * 0.08;
    ctx.fillStyle = '#8a939e';
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(phase + i) * 3, y + Math.sin(phase * 0.8 + i) * 2, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const spark = (phase * 3 + i * 0.7) % 1;
    ctx.globalAlpha = 1 - spark;
    ctx.fillStyle = i % 2 ? '#ffd27a' : '#ff7a3a';
    ctx.fillRect(-30 + i * 8, -6 - spark * 18, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawDebris(ctx: CanvasRenderingContext2D, phase: number) {
  const bits = [
    { x: 8, y: -4, w: 10, h: 4, rot: 0.4 },
    { x: 16, y: 12, w: 7, h: 3, rot: -0.6 },
    { x: -8, y: -16, w: 5, h: 5, rot: phase * 0.4 },
  ];
  bits.forEach((bit) => {
    ctx.save();
    ctx.translate(bit.x, bit.y + Math.sin(phase + bit.x) * 2);
    ctx.rotate(bit.rot);
    ctx.fillStyle = '#8b97a6';
    ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
    ctx.strokeStyle = '#1a2230';
    ctx.strokeRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
    ctx.restore();
  });
  burn(ctx, 12, 2, phase);
  burn(ctx, 36, -6, phase + 1);
}

function roundLocal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export function paintArkCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const cssW = canvas.clientWidth || Number(canvas.getAttribute('width')) || 340;
  const cssH = canvas.clientHeight || Number(canvas.getAttribute('height')) || 160;
  if (!canvas.style.width) canvas.style.width = `${cssW}px`;
  if (!canvas.style.height) canvas.style.height = `${cssH}px`;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const state = arkStateFrom((canvas.dataset.ark as ArkState) || 'intact');
  const scale = Number(canvas.dataset.scale || '1');
  const tilt = Number(canvas.dataset.tilt || '0');
  const phase = canvas.dataset.phase ? Number(canvas.dataset.phase) : 0.65;
  drawColonyArk(ctx, cssW / 2, cssH * 0.56, scale, tilt, state, phase);
}
