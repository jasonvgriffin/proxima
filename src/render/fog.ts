import { hash } from '../art/draw';

/** 0 unexplored, 1 remembered, 2 in sight. */
export type FogValue = 0 | 1 | 2;

export const FOG_SCALE = 4;

/** Shroud and remembered-ground canvases, in pixels. They grow with the map. */
export function fogCanvasSize(mapWidth: number, mapHeight: number): { width: number; height: number } {
  return {
    width: Math.max(1, mapWidth * FOG_SCALE),
    height: Math.max(1, mapHeight * FOG_SCALE),
  };
}

/**
 * Soft masks for the two covered states.
 * Shroud pixels are dark with alpha for unexplored ground.
 * Remembered pixels are white with alpha, used to keep a desaturated copy.
 */
export function paintFogMasks(
  shroud: HTMLCanvasElement,
  remembered: HTMLCanvasElement,
  mask: Uint8Array,
  width: number,
  height: number,
) {
  const sized = fogCanvasSize(width, height);
  const w = sized.width;
  const h = sized.height;
  shroud.width = w;
  shroud.height = h;
  remembered.width = w;
  remembered.height = h;
  const sctx = shroud.getContext('2d');
  const rctx = remembered.getContext('2d');
  if (!sctx || !rctx) return;
  const simg = sctx.createImageData(w, h);
  const rimg = rctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const fx = px / FOG_SCALE - 0.5;
      const fy = py / FOG_SCALE - 0.5;
      const x0 = clamp(Math.floor(fx), 0, width - 1);
      const y0 = clamp(Math.floor(fy), 0, height - 1);
      const x1 = clamp(x0 + 1, 0, width - 1);
      const y1 = clamp(y0 + 1, 0, height - 1);
      const sx = Math.max(0, Math.min(1, fx - x0));
      const sy = Math.max(0, Math.min(1, fy - y0));
      const samples: [number, number][] = [
        [mask[y0 * width + x0], (1 - sx) * (1 - sy)],
        [mask[y0 * width + x1], sx * (1 - sy)],
        [mask[y1 * width + x0], (1 - sx) * sy],
        [mask[y1 * width + x1], sx * sy],
      ];
      let unexplored = 0;
      let recalled = 0;
      for (const [state, weight] of samples) {
        if (state <= 0) unexplored += weight;
        else if (state === 1) recalled += weight;
      }
      const i = (py * w + px) * 4;
      simg.data[i] = 5;
      simg.data[i + 1] = 7;
      simg.data[i + 2] = 14;
      simg.data[i + 3] = Math.round(unexplored * 255);
      rimg.data[i] = 255;
      rimg.data[i + 1] = 255;
      rimg.data[i + 2] = 255;
      rimg.data[i + 3] = Math.round(recalled * 230);
    }
  }
  sctx.putImageData(simg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  soften(shroud, 3.2);
  soften(remembered, 2.6);
  sprinkleStars(shroud);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function soften(canvas: HTMLCanvasElement, radius: number) {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const ctx = tmp.getContext('2d');
  if (!ctx) return;
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  const dest = canvas.getContext('2d');
  if (!dest) return;
  dest.clearRect(0, 0, canvas.width, canvas.height);
  dest.drawImage(tmp, 0, 0);
}

function sprinkleStars(canvas: HTMLCanvasElement) {
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const saved = mask.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!saved || !ctx) return;
  saved.drawImage(canvas, 0, 0);
  const count = Math.round((canvas.width * canvas.height) / 180);
  for (let i = 0; i < count; i++) {
    const x = hash(i, 3) * canvas.width;
    const y = hash(i, 11) * canvas.height;
    ctx.fillStyle = i % 8 === 0 ? 'rgba(232, 214, 170, 0.9)' : 'rgba(214, 224, 240, 0.75)';
    ctx.fillRect(x, y, i % 13 === 0 ? 1.6 : 1, i % 13 === 0 ? 1.6 : 1);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
