import type { FactionId } from '../core/types';
import { FACTIONS } from '../core/factions';

/**
 * Original poster-style busts. Flat shapes, faction colors, and one signature
 * piece of gear so each leader stays recognizable at thumbnail size.
 * These figures are invented. They are not drawn from any real person.
 */

interface BustSpec {
  skin: string;
  shadow: string;
  hair: string;
  hairLite: string;
  eye: string;
  lip: string;
  blush: string;
  headRx: number;
  headRy: number;
  jaw: number;
  eyeGap: number;
  smile: number;
  ears: boolean;
}

const BUSTS: Record<FactionId, BustSpec> = {
  helm: {
    skin: '#f0c7a4',
    shadow: '#c48462',
    hair: '#3a2a22',
    hairLite: '#6b4a32',
    eye: '#5c4632',
    lip: '#a85b58',
    blush: '#e0a08a',
    headRx: 34,
    headRy: 44,
    jaw: 0.35,
    eyeGap: 15,
    smile: 1,
    ears: true,
  },
  verdantia: {
    skin: '#e0c09a',
    shadow: '#a67b52',
    hair: '#1d3b28',
    hairLite: '#3f7a48',
    eye: '#2f6b40',
    lip: '#b46a58',
    blush: '#d9a07a',
    headRx: 36,
    headRy: 42,
    jaw: 0.15,
    eyeGap: 16,
    smile: 5,
    ears: true,
  },
  genesis: {
    skin: '#efd0b8',
    shadow: '#c49880',
    hair: '#4a3428',
    hairLite: '#8a6848',
    eye: '#3e6f6c',
    lip: '#b86a68',
    blush: '#e8b0a0',
    headRx: 31,
    headRy: 48,
    jaw: 0.2,
    eyeGap: 14,
    smile: 2,
    ears: true,
  },
  ironclad: {
    skin: '#c48a62',
    shadow: '#8a5438',
    hair: '#241816',
    hairLite: '#4a3028',
    eye: '#3a241c',
    lip: '#8d4038',
    blush: '#b86a48',
    headRx: 38,
    headRy: 42,
    jaw: 0.95,
    eyeGap: 16,
    smile: -2,
    ears: false,
  },
  mnemosyne: {
    skin: '#f3d0c2',
    shadow: '#c99284',
    hair: '#1a2438',
    hairLite: '#6e8ec8',
    eye: '#2c4e88',
    lip: '#b86e86',
    blush: '#e8b0b4',
    headRx: 30,
    headRy: 46,
    jaw: 0.25,
    eyeGap: 14,
    smile: 2,
    ears: false,
  },
  clio: {
    skin: '#f6d5c4',
    shadow: '#d0a090',
    hair: '#5c3048',
    hairLite: '#c488a8',
    eye: '#6a4060',
    lip: '#c47088',
    blush: '#f0b0b8',
    headRx: 33,
    headRy: 44,
    jaw: 0.1,
    eyeGap: 15,
    smile: 6,
    ears: true,
  },
};

export function drawPortrait(ctx: CanvasRenderingContext2D, faction: FactionId, w: number, h: number) {
  const spec = BUSTS[faction];
  const colors = FACTIONS[faction].colors;
  const px = (n: number) => (n / 200) * w;
  const py = (n: number) => (n / 260) * h;
  const cx = px(100);
  const cy = py(112);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, colors.ink);
  sky.addColorStop(1, colors.deep);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = colors.main;
  ctx.beginPath();
  ctx.arc(cx, cy, px(78), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  paintMotif(ctx, faction, px, py, colors.main);

  paintShoulders(ctx, faction, px, py, colors.main, colors.deep, colors.ink);

  ctx.fillStyle = spec.shadow;
  ctx.beginPath();
  ctx.moveTo(px(86), py(156));
  ctx.lineTo(px(114), py(156));
  ctx.lineTo(px(120), py(214));
  ctx.lineTo(px(80), py(214));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = spec.skin;
  ctx.fillRect(px(90), py(150), px(20), py(58));

  if (spec.ears) {
    ctx.fillStyle = spec.skin;
    ctx.beginPath();
    ctx.ellipse(cx - px(spec.headRx * 0.92), cy + py(4), px(7), py(10), 0, 0, Math.PI * 2);
    ctx.ellipse(cx + px(spec.headRx * 0.92), cy + py(4), px(7), py(10), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  paintHairBack(ctx, faction, px, py, spec);

  ctx.save();
  traceHead(ctx, cx, cy, px(spec.headRx), py(spec.headRy), spec.jaw);
  ctx.clip();
  ctx.fillStyle = spec.skin;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = spec.shadow;
  ctx.beginPath();
  ctx.ellipse(cx + px(16), cy + py(8), px(spec.headRx * 0.72), py(spec.headRy * 0.86), 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = spec.blush;
  ctx.beginPath();
  ctx.ellipse(cx - px(16), cy + py(14), px(8), py(5), 0, 0, Math.PI * 2);
  ctx.ellipse(cx + px(16), cy + py(14), px(8), py(5), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const eyeY = cy - py(2);
  const gap = px(spec.eyeGap);
  paintEye(ctx, cx - gap, eyeY, px(7.2), py(5.2), spec.eye);
  paintEye(ctx, cx + gap, eyeY, px(7.2), py(5.2), spec.eye);
  paintBrows(ctx, cx, eyeY, gap, px(7.2), py(5.2), spec.hair, faction);

  ctx.strokeStyle = spec.shadow;
  ctx.lineWidth = Math.max(1.25, w * 0.012);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + py(8));
  ctx.quadraticCurveTo(cx + px(5), eyeY + py(20), cx - px(1), eyeY + py(26));
  ctx.stroke();

  const mouthY = cy + py(28);
  ctx.strokeStyle = spec.lip;
  ctx.lineWidth = Math.max(1.4, w * 0.014);
  ctx.beginPath();
  ctx.moveTo(cx - px(11), mouthY);
  ctx.quadraticCurveTo(cx, mouthY + py(spec.smile), cx + px(11), mouthY);
  ctx.stroke();
  if (spec.smile > 3) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = spec.lip;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + py(2), px(7), py(3.2), 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  paintHairFront(ctx, faction, px, py, spec);
  paintGear(ctx, faction, px, py, colors.main, colors.deep, colors.ink, spec);

  const frame = Math.max(2, w * 0.018);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = frame;
  ctx.strokeRect(frame / 2, frame / 2, w - frame, h - frame);
  ctx.restore();
}

function paintMotif(
  ctx: CanvasRenderingContext2D,
  faction: FactionId,
  px: (n: number) => number,
  py: (n: number) => number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = Math.max(1, px(1.4));
  if (faction === 'helm') {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(px(20 + i * 18), py(16));
      ctx.lineTo(px(20 + i * 18), py(70));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(px(16), py(40));
    ctx.lineTo(px(184), py(40));
    ctx.stroke();
  } else if (faction === 'verdantia') {
    ctx.beginPath();
    ctx.moveTo(px(30), py(230));
    ctx.quadraticCurveTo(px(70), py(40), px(40), py(20));
    ctx.moveTo(px(170), py(220));
    ctx.quadraticCurveTo(px(120), py(60), px(168), py(24));
    ctx.stroke();
  } else if (faction === 'genesis') {
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      const x = px(156) + Math.sin(p * Math.PI * 3) * px(14);
      const y = py(36 + p * 90);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (faction === 'ironclad') {
    ctx.beginPath();
    ctx.moveTo(px(24), py(36));
    ctx.lineTo(px(48), py(20));
    ctx.lineTo(px(72), py(36));
    ctx.moveTo(px(128), py(36));
    ctx.lineTo(px(152), py(20));
    ctx.lineTo(px(176), py(36));
    ctx.stroke();
  } else if (faction === 'mnemosyne') {
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.12 + (i % 3) * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, py(30 + i * 16));
      ctx.lineTo(px(200), py(30 + i * 16));
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(px(16), py(48));
    ctx.lineTo(px(46), py(48));
    ctx.lineTo(px(58), py(28));
    ctx.lineTo(px(74), py(70));
    ctx.lineTo(px(90), py(40));
    ctx.lineTo(px(120), py(40));
    ctx.stroke();
  }
  ctx.restore();
}

function paintShoulders(
  ctx: CanvasRenderingContext2D,
  faction: FactionId,
  px: (n: number) => number,
  py: (n: number) => number,
  main: string,
  deep: string,
  ink: string,
) {
  ctx.fillStyle = deep;
  if (faction === 'ironclad') {
    ctx.beginPath();
    ctx.moveTo(px(18), py(250));
    ctx.lineTo(px(46), py(176));
    ctx.lineTo(px(78), py(198));
    ctx.lineTo(px(122), py(198));
    ctx.lineTo(px(154), py(176));
    ctx.lineTo(px(182), py(250));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.fillRect(px(78), py(196), px(44), py(10));
  } else if (faction === 'verdantia') {
    ctx.fillStyle = '#245c38';
    ctx.beginPath();
    ctx.moveTo(px(20), py(260));
    ctx.quadraticCurveTo(px(40), py(180), px(100), py(188));
    ctx.quadraticCurveTo(px(160), py(180), px(180), py(260));
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.ellipse(px(48), py(196), px(18), py(10), -0.6, 0, Math.PI * 2);
    ctx.ellipse(px(152), py(196), px(18), py(10), 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (faction === 'clio') {
    ctx.fillStyle = '#f2d5e4';
    ctx.beginPath();
    ctx.moveTo(px(28), py(260));
    ctx.quadraticCurveTo(px(100), py(176), px(172), py(260));
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(1.5, px(2));
    ctx.beginPath();
    ctx.moveTo(px(70), py(214));
    ctx.lineTo(px(92), py(214));
    ctx.lineTo(px(100), py(200));
    ctx.lineTo(px(112), py(228));
    ctx.lineTo(px(124), py(208));
    ctx.lineTo(px(136), py(208));
    ctx.stroke();
  } else if (faction === 'genesis') {
    ctx.fillStyle = ink;
    ctx.fillRect(px(36), py(200), px(128), py(70));
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(1.5, px(2));
    ctx.strokeRect(px(78), py(208), px(18), py(28));
    ctx.fillStyle = deep;
    ctx.fillRect(px(82), py(214), px(10), py(16));
  } else if (faction === 'mnemosyne') {
    ctx.fillStyle = '#243656';
    ctx.beginPath();
    ctx.moveTo(px(30), py(260));
    ctx.lineTo(px(58), py(188));
    ctx.lineTo(px(142), py(188));
    ctx.lineTo(px(170), py(260));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(px(48), py(250));
    ctx.lineTo(px(118), py(186));
    ctx.lineTo(px(128), py(196));
    ctx.lineTo(px(62), py(260));
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#d9c7a2';
    ctx.beginPath();
    ctx.moveTo(px(34), py(260));
    ctx.lineTo(px(62), py(184));
    ctx.lineTo(px(138), py(184));
    ctx.lineTo(px(166), py(260));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.fillRect(px(62), py(184), px(76), py(8));
    ctx.fillStyle = ink;
    ctx.fillRect(px(92), py(198), px(16), py(8));
  }
}

function traceHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, jaw: number) {
  const chin = ry * (0.9 + jaw * 0.06);
  const cheek = rx * (0.82 + jaw * 0.16);
  const spread = 0.35 + jaw * 0.45;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.9, cy - ry * 0.98, cx + rx, cy - ry * 0.2, cx + cheek, cy + ry * 0.28);
  ctx.quadraticCurveTo(cx + cheek * spread, cy + chin, cx, cy + chin);
  ctx.quadraticCurveTo(cx - cheek * spread, cy + chin, cx - cheek, cy + ry * 0.28);
  ctx.bezierCurveTo(cx - rx, cy - ry * 0.2, cx - rx * 0.9, cy - ry * 0.98, cx, cy - ry);
  ctx.closePath();
}

function paintEye(ctx: CanvasRenderingContext2D, x: number, y: number, rw: number, rh: number, iris: string) {
  ctx.fillStyle = '#fbf6f1';
  ctx.beginPath();
  ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x, y, rw * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#140e0c';
  ctx.beginPath();
  ctx.arc(x, y + rh * 0.05, rw * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - rw * 0.22, y - rh * 0.28, Math.max(0.8, rw * 0.16), 0, Math.PI * 2);
  ctx.fill();
}

function paintBrows(
  ctx: CanvasRenderingContext2D,
  cx: number,
  eyeY: number,
  gap: number,
  rw: number,
  rh: number,
  color: string,
  faction: FactionId,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, rw * 0.38);
  ctx.lineCap = 'round';
  const lift = faction === 'ironclad' ? rh * 0.2 : faction === 'clio' ? rh * 0.45 : 0;
  ctx.beginPath();
  ctx.moveTo(cx - gap - rw * 1.15, eyeY - rh * 1.7);
  ctx.quadraticCurveTo(cx - gap, eyeY - rh * 2.3, cx - gap + rw * 1.2, eyeY - rh * 1.45);
  ctx.moveTo(cx + gap - rw * 1.2, eyeY - rh * 1.45 - lift);
  ctx.quadraticCurveTo(cx + gap, eyeY - rh * (2.3 + (faction === 'clio' ? 0.35 : 0)), cx + gap + rw * 1.15, eyeY - rh * 1.7);
  ctx.stroke();
}

function paintHairBack(
  ctx: CanvasRenderingContext2D,
  faction: FactionId,
  px: (n: number) => number,
  py: (n: number) => number,
  spec: BustSpec,
) {
  ctx.fillStyle = spec.hair;
  if (faction === 'verdantia') {
    for (const [x, y] of [
      [62, 78],
      [100, 58],
      [138, 78],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px(x), py(y), px(18), py(16), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = spec.hairLite;
    ctx.beginPath();
    ctx.ellipse(px(100), py(52), px(8), py(8), 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (faction === 'genesis') {
    ctx.beginPath();
    ctx.ellipse(px(100), py(78), px(40), py(36), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px(118), py(90), px(16), py(90));
    ctx.fillStyle = spec.hairLite;
    ctx.fillRect(px(122), py(108), px(8), py(18));
  } else if (faction === 'clio') {
    ctx.beginPath();
    ctx.moveTo(px(70), py(90));
    ctx.quadraticCurveTo(px(40), py(150), px(58), py(210));
    ctx.quadraticCurveTo(px(78), py(160), px(88), py(100));
    ctx.fill();
  } else if (faction === 'mnemosyne' || faction === 'helm' || faction === 'ironclad') {
    ctx.beginPath();
    ctx.ellipse(px(100), py(78), px(spec.headRx + 6), py(30), 0, Math.PI, 0);
    ctx.fill();
  }
}

function paintHairFront(
  ctx: CanvasRenderingContext2D,
  faction: FactionId,
  px: (n: number) => number,
  py: (n: number) => number,
  spec: BustSpec,
) {
  ctx.fillStyle = spec.hair;
  if (faction === 'helm') {
    ctx.beginPath();
    ctx.moveTo(px(66), py(96));
    ctx.lineTo(px(78), py(64));
    ctx.lineTo(px(108), py(58));
    ctx.lineTo(px(136), py(72));
    ctx.lineTo(px(128), py(96));
    ctx.quadraticCurveTo(px(100), py(84), px(66), py(96));
    ctx.fill();
    ctx.fillStyle = spec.hairLite;
    ctx.fillRect(px(104), py(62), px(8), py(22));
  } else if (faction === 'verdantia') {
    ctx.fillStyle = spec.hairLite;
    ctx.beginPath();
    ctx.ellipse(px(78), py(86), px(10), py(7), -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (faction === 'genesis') {
    ctx.beginPath();
    ctx.moveTo(px(68), py(100));
    ctx.quadraticCurveTo(px(100), py(62), px(132), py(96));
    ctx.lineTo(px(120), py(108));
    ctx.quadraticCurveTo(px(100), py(86), px(78), py(108));
    ctx.fill();
  } else if (faction === 'ironclad') {
    ctx.fillRect(px(68), py(86), px(10), py(16));
    ctx.fillRect(px(122), py(86), px(12), py(16));
  } else if (faction === 'mnemosyne') {
    ctx.beginPath();
    ctx.moveTo(px(70), py(100));
    ctx.quadraticCurveTo(px(90), py(60), px(132), py(78));
    ctx.lineTo(px(124), py(98));
    ctx.quadraticCurveTo(px(96), py(82), px(74), py(108));
    ctx.fill();
    ctx.fillStyle = spec.hairLite;
    ctx.beginPath();
    ctx.moveTo(px(108), py(70));
    ctx.lineTo(px(122), py(78));
    ctx.lineTo(px(112), py(90));
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(px(64), py(108));
    ctx.quadraticCurveTo(px(86), py(58), px(118), py(78));
    ctx.lineTo(px(108), py(100));
    ctx.quadraticCurveTo(px(86), py(82), px(72), py(112));
    ctx.fill();
  }
}

function paintGear(
  ctx: CanvasRenderingContext2D,
  faction: FactionId,
  px: (n: number) => number,
  py: (n: number) => number,
  main: string,
  deep: string,
  ink: string,
  spec: BustSpec,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (faction === 'helm') {
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(2, px(3));
    ctx.beginPath();
    ctx.moveTo(px(72), py(80));
    ctx.quadraticCurveTo(px(100), py(68), px(128), py(80));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(94), py(78));
    ctx.lineTo(px(100), py(68));
    ctx.lineTo(px(106), py(78));
    ctx.stroke();
  } else if (faction === 'verdantia') {
    ctx.fillStyle = '#8fd18a';
    ctx.beginPath();
    ctx.ellipse(px(124), py(96), px(12), py(6), 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.shadow;
    for (const x of [86, 100, 114]) {
      ctx.beginPath();
      ctx.arc(px(x), py(132), px(1.6), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (faction === 'genesis') {
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(2, px(2.4));
    ctx.beginPath();
    ctx.moveTo(px(64), py(108));
    ctx.quadraticCurveTo(px(100), py(96), px(136), py(108));
    ctx.stroke();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1, px(1.2));
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const p = i / 12;
      const x = px(168) + Math.sin(p * Math.PI * 2) * px(8);
      const y = py(70 + p * 48);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (faction === 'ironclad') {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(px(58), py(96));
    ctx.lineTo(px(74), py(52));
    ctx.lineTo(px(126), py(52));
    ctx.lineTo(px(142), py(96));
    ctx.lineTo(px(126), py(88));
    ctx.lineTo(px(74), py(88));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.fillRect(px(96), py(54), px(8), py(34));
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(1.5, px(1.6));
    ctx.strokeRect(px(70), py(100), px(60), py(16));
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(px(78), py(128));
    ctx.lineTo(px(92), py(120));
    ctx.lineTo(px(90), py(132));
    ctx.fill();
  } else if (faction === 'mnemosyne') {
    ctx.strokeStyle = main;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(2, px(2.6));
    ctx.beginPath();
    ctx.moveTo(px(68), py(108));
    ctx.quadraticCurveTo(px(100), py(52), px(132), py(108));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(66), py(116), px(9), 0, Math.PI * 2);
    ctx.arc(px(134), py(116), px(9), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(134), py(124));
    ctx.quadraticCurveTo(px(118), py(146), px(104), py(144));
    ctx.stroke();
  } else {
    ctx.fillStyle = '#e7eef2';
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1.4, px(1.6));
    ctx.beginPath();
    ctx.moveTo(px(126), py(58));
    ctx.lineTo(px(156), py(72));
    ctx.lineTo(px(150), py(104));
    ctx.lineTo(px(120), py(90));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(138), py(80), px(5.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = deep;
    ctx.beginPath();
    ctx.arc(px(138), py(80), px(1.8), 0, Math.PI * 2);
    ctx.fill();
  }
}
