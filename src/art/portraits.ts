import { FACTIONS } from '../core/factions';
import { FACTION_IDS, type FactionId } from '../core/types';

/**
 * Painted leader portraits. Files live in public/portraits so the Vite build
 * copies them into dist/, which is what the Electron package ships.
 * Square head-and-shoulders, drawn into whatever frame a screen asks for.
 */

const images = new Map<FactionId, HTMLImageElement>();
let onReady: (() => void) | null = null;

export function leaderPortraitUrl(id: FactionId): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}portraits/${id}.webp`;
}

/** Repaint canvases once a portrait file finishes loading. */
export function watchLeaderPortraits(repaint: () => void) {
  onReady = repaint;
}

export function preloadLeaderPortraits() {
  for (const id of FACTION_IDS) imageFor(id);
}

function imageFor(id: FactionId): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = images.get(id);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = leaderPortraitUrl(id);
    img.addEventListener('load', () => onReady?.());
    images.set(id, img);
  }
  return img;
}

/** The one painter every leader canvas uses: faction select, diplomacy, profiles. */
export function drawPortrait(ctx: CanvasRenderingContext2D, faction: FactionId, w: number, h: number) {
  const img = imageFor(faction);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const colors = FACTIONS[faction].colors;
    ctx.fillStyle = colors.ink;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors.deep;
    ctx.fillRect(0, Math.round(h * 0.62), w, Math.ceil(h * 0.38));
  }
  ctx.restore();
}
