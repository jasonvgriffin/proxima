import type { App } from './app';
import { paintArkCanvas } from '../art/ark';
import { drawEmblem } from '../art/draw';
import { drawPortrait } from '../art/portraits';
import { paintUnitIcon } from '../art/units';
import { type FactionId } from '../core/types';

export function paintEmblems(this: App) {
  for (const root of [this.stage, this.overlay]) this.paintMarks(root);
}

export function paintMarks(this: App, root: ParentNode) {
  root.querySelectorAll('canvas[data-emblem]').forEach((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawEmblem(ctx, canvas.dataset.emblem as FactionId, canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4);
  });
  root.querySelectorAll('canvas[data-portrait]').forEach((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const faction = canvas.dataset.portrait as FactionId | undefined;
    if (!ctx || !faction) return;
    drawPortrait(ctx, faction, canvas.width, canvas.height);
  });
  root.querySelectorAll('canvas[data-unit-icon]').forEach((node) => paintUnitIcon(node as HTMLCanvasElement));
  root.querySelectorAll('canvas[data-ark]').forEach((node) => paintArkCanvas(node as HTMLCanvasElement));
}

