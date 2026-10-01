import { FACTIONS } from '../core/factions';
import { FACTION_IDS, type FactionId } from '../core/types';
import { UNIT_KINDS, UNIT_KIND_LABELS, unitIconTag } from './units';

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/** Contact sheet: every silhouette in every faction color, plus the ark states. */
export function unitContactSheetMarkup(): string {
  const head = FACTION_IDS.map((id) => `<div class="sheet-label">${esc(FACTIONS[id].name)}</div>`).join('');
  const rows = UNIT_KINDS.map((kind) => {
    const cells = FACTION_IDS.map((id) => icon(kind, id)).join('');
    return `<div class="sheet-label">${esc(UNIT_KIND_LABELS[kind])}</div>${cells}`;
  }).join('');
  const states = [
    unitIconTag({ kind: 'walker', color: FACTIONS.ironclad.colors.main, deep: FACTIONS.ironclad.colors.deep, selected: true, hp: 11, maxHp: 11, phase: 0.9 }),
    unitIconTag({ kind: 'walker', color: FACTIONS.ironclad.colors.main, deep: FACTIONS.ironclad.colors.deep, hp: 4, maxHp: 11, phase: 0.9 }),
    unitIconTag({ kind: 'infantry', color: FACTIONS.helm.colors.main, deep: FACTIONS.helm.colors.deep, stack: 3, hp: 10, maxHp: 10, phase: 0.9 }),
    unitIconTag({ kind: 'terraformer', color: FACTIONS.verdantia.colors.main, deep: FACTIONS.verdantia.colors.deep, working: true, hp: 8, maxHp: 8, phase: 1.2 }),
    unitIconTag({ kind: 'colony', color: FACTIONS.genesis.colors.main, deep: FACTIONS.genesis.colors.deep, phase: 0.4 }),
    unitIconTag({ kind: 'transport', color: FACTIONS.clio.colors.main, deep: FACTIONS.clio.colors.deep, phase: 0.8 }),
  ].join('');
  const arks = [
    ['intact', '1', '-0.18', 'Intact · 1x'],
    ['intact', '1.25', '-0.18', 'Intact · 1.25x'],
    ['intact', '1.5', '-0.18', 'Intact · 1.5x'],
    ['impact', '1', '0.45', 'Impact · 1x'],
    ['impact', '1.25', '0.45', 'Impact · 1.25x'],
    ['impact', '1.5', '0.45', 'Impact · 1.5x'],
    ['breakup', '1', '0.15', 'Breakaway · 1x'],
    ['breakup', '1.25', '0.15', 'Breakaway · 1.25x'],
    ['breakup', '1.5', '0.15', 'Breakaway · 1.5x'],
  ]
    .map(([state, scale, tilt, label]) => {
      const width = Math.round(340 * Number(scale));
      const height = Math.round(150 * Number(scale));
      return `<figure class="ark-card">
        <canvas data-ark="${state}" data-scale="${scale}" data-tilt="${tilt}" data-phase="0.7" width="${width}" height="${height}" style="width:${width}px;height:${height}px"></canvas>
        <figcaption>${esc(label)}</figcaption>
      </figure>`;
    })
    .join('');

  return `
    <div class="unit-sheet" id="unit-sheet" data-testid="unit-sheet">
      <h2>Units</h2>
      <div class="unit-grid">
        <div></div>
        ${head}
        ${rows}
      </div>
      <h2>States</h2>
      <div class="unit-states">${states}</div>
      <h2>Colony ark</h2>
      <div class="ark-row">${arks}</div>
    </div>`;
}

function icon(kind: string, faction: FactionId): string {
  const colors = FACTIONS[faction].colors;
  return unitIconTag({ kind, color: colors.main, deep: colors.deep, phase: 0.9 });
}
