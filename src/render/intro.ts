import { FACTION_IDS } from '../core/types';
import { drawArk, drawEmblem, drawPlanet, drawPod, drawStar, drawStarfield } from '../art/draw';
import { FACTIONS } from '../core/factions';

export const INTRO_SCENES = [
  {
    title: 'Proxima b',
    text: 'Proxima b keeps one face toward its star. Between the burning day and the frozen night, a thin twilight is the only place a person can stand.',
  },
  {
    title: 'The ark',
    text: 'The ark was built to arrive whole. It met the air at the wrong angle, and the sky tore it open.',
  },
  {
    title: 'Impact',
    text: 'The hull failed along the terminator. Fire on one side, ice on the other, and a scar of metal between.',
  },
  {
    title: 'Breakaway',
    text: 'Pods and cutters broke from the wreck. Nobody steered them. The planet chose where they fell.',
  },
  {
    title: 'Scatter',
    text: 'Survivors walked away from the fires in different directions, each carrying a different piece of the ship and a different memory.',
  },
  {
    title: 'Six factions',
    text: 'Six factions woke with no shared command. The Helm, Verdantia, Genesis, Ironclad, Mnemosyne, and Clio. Only one will decide what Proxima becomes.',
  },
];

export class IntroPlayer {
  private raf = 0;
  private t = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private getScene: () => number,
  ) {
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  private frame = () => {
    this.t += 0.016;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw() {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const scene = this.getScene();
    drawStarfield(ctx, w, h, this.t * 8);
    if (scene === 0) {
      drawStar(ctx, w * 0.22, h * 0.42, 36, this.t);
      drawPlanet(ctx, w * 0.62, h * 0.46, 92, this.t);
    } else if (scene === 1) {
      drawPlanet(ctx, w * 0.7, h * 0.62, 120, this.t);
      drawArk(ctx, w * 0.38 + Math.sin(this.t) * 8, h * 0.32, 1.3, -0.25, false);
    } else if (scene === 2) {
      drawPlanet(ctx, w * 0.5, h * 0.72, 150, this.t);
      drawArk(ctx, w * 0.48, h * 0.48 + Math.sin(this.t * 6) * 2, 1.5, 0.6, true);
      ctx.fillStyle = `rgba(255,120,40,${0.15 + Math.sin(this.t * 8) * 0.1})`;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.58, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (scene === 3) {
      drawPlanet(ctx, w * 0.5, h * 0.78, 160, this.t);
      drawArk(ctx, w * 0.42, h * 0.58, 1.1, 0.4, true);
      FACTION_IDS.forEach((id, i) => {
        const angle = this.t * 0.4 + i;
        drawPod(ctx, w * 0.42 + Math.cos(angle) * (40 + i * 14), h * 0.4 + Math.sin(angle) * 18, FACTIONS[id].colors.main);
      });
    } else if (scene === 4) {
      ctx.fillStyle = '#1a2433';
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.fillStyle = '#c4552a';
      ctx.fillRect(0, h * 0.45, w * 0.33, h * 0.55);
      ctx.fillStyle = '#6f8f86';
      ctx.fillRect(w * 0.33, h * 0.45, w * 0.34, h * 0.55);
      ctx.fillStyle = '#24344a';
      ctx.fillRect(w * 0.67, h * 0.45, w * 0.33, h * 0.55);
      for (let i = 0; i < 6; i++) {
        const dir = i - 2.5;
        const x = w * 0.5 + dir * (30 + this.t * 18);
        const y = h * 0.62 + Math.abs(dir) * 10;
        ctx.fillStyle = '#e7edf6';
        ctx.fillRect(x, y, 4, 8);
      }
    } else {
      drawPlanet(ctx, w * 0.5, h * 0.78, 90, this.t);
      FACTION_IDS.forEach((id, i) => {
        const x = w * (0.12 + i * 0.15);
        const y = h * 0.38 + Math.sin(this.t + i) * 6;
        drawEmblem(ctx, id, x, y, 28);
        ctx.fillStyle = FACTIONS[id].colors.main;
        ctx.font = '14px Fraunces, serif';
        ctx.textAlign = 'center';
        ctx.fillText(FACTIONS[id].name, x, y + 48);
      });
    }
  }
}
