import { ancestorIds, descendantIds, turnsToFinish } from '../core/researchPath';
import { TECHS, TECH_LANES, techById, type TechDef, type TechLane } from '../core/tech';
import type { TechOrigin } from '../core/types';

const NODE_W = 188;
const NODE_H = 104;
const GAP_X = 64;
const GAP_Y = 12;
const SUB_GAP = 12;
const LABEL_H = 20;
const LANE_PAD = 18;
const MARGIN_X = 16;
const MARGIN_Y = 12;

function stackShape(count: number): { cols: number; rows: number } {
  if (count >= 3) return { cols: 2, rows: Math.ceil(count / 2) };
  return { cols: 1, rows: Math.max(1, count) };
}

export interface TechTreeCam {
  x: number;
  y: number;
  zoom: number;
}

export interface TechTreeModel {
  points: number;
  rate: number;
  known: readonly string[];
  researching: string | null;
  goal: string | null;
  queue: readonly string[];
  origins: Readonly<Record<string, TechOrigin | undefined>>;
  selected: string | null;
  notice: string;
  cam: TechTreeCam;
}

export interface TechNodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lane: TechLane;
}

export interface TechTreeLayout {
  width: number;
  height: number;
  nodes: TechNodeBox[];
  lanes: { id: TechLane; label: string; y: number; h: number }[];
}

export function layoutTechTree(techs: readonly TechDef[] = TECHS): TechTreeLayout {
  const grouped = TECH_LANES.map((lane) => {
    const byCol = new Map<number, TechDef[]>();
    for (const tech of techs.filter((entry) => entry.lane === lane.id)) {
      const list = byCol.get(tech.column) ?? [];
      list.push(tech);
      byCol.set(tech.column, list);
    }
    for (const list of byCol.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return { lane, byCol };
  });
  const columns = [...new Set(techs.map((tech) => tech.column))].sort((a, b) => a - b);
  const columnCols = new Map<number, number>();
  for (const column of columns) {
    let cols = 1;
    for (const group of grouped) cols = Math.max(cols, stackShape(group.byCol.get(column)?.length ?? 0).cols);
    columnCols.set(column, cols);
  }
  const columnX = new Map<number, number>();
  let cursor = MARGIN_X;
  for (const column of columns) {
    columnX.set(column, cursor);
    const cols = columnCols.get(column) ?? 1;
    cursor += cols * NODE_W + Math.max(0, cols - 1) * SUB_GAP + GAP_X;
  }

  const nodes: TechNodeBox[] = [];
  const lanes: TechTreeLayout['lanes'] = [];
  let y = MARGIN_Y;
  for (const group of grouped) {
    const shapes = [...group.byCol.values()].map((list) => stackShape(list.length));
    const rows = Math.max(1, ...shapes.map((shape) => shape.rows));
    const stackHeight = rows * NODE_H + Math.max(0, rows - 1) * GAP_Y;
    const laneTop = y;
    y += LABEL_H;
    for (const [column, list] of group.byCol) {
      const shape = stackShape(list.length);
      const usedH = shape.rows * NODE_H + Math.max(0, shape.rows - 1) * GAP_Y;
      const originX = columnX.get(column) ?? MARGIN_X;
      const slotW = shape.cols * NODE_W + Math.max(0, shape.cols - 1) * SUB_GAP;
      const columnW = (columnCols.get(column) ?? 1) * NODE_W + Math.max(0, (columnCols.get(column) ?? 1) - 1) * SUB_GAP;
      const originY = y + (stackHeight - usedH) / 2;
      list.forEach((tech, index) => {
        const col = index % shape.cols;
        const row = Math.floor(index / shape.cols);
        nodes.push({
          id: tech.id,
          x: originX + (columnW - slotW) / 2 + col * (NODE_W + SUB_GAP),
          y: originY + row * (NODE_H + GAP_Y),
          w: NODE_W,
          h: NODE_H,
          lane: group.lane.id,
        });
      });
    }
    y += stackHeight;
    lanes.push({ id: group.lane.id, label: group.lane.label, y: laneTop, h: y - laneTop });
    y += LANE_PAD;
  }
  const width = nodes.reduce((max, node) => Math.max(max, node.x + node.w), cursor) + MARGIN_X;
  const height = Math.max(y, MARGIN_Y) + 8;
  return { width, height, nodes, lanes };
}

function stateOf(tech: TechDef, model: TechTreeModel): 'known' | 'researching' | 'available' | 'locked' {
  if (model.known.includes(tech.id)) return 'known';
  if (model.researching === tech.id) return 'researching';
  if (tech.requires.every((req) => model.known.includes(req))) return 'available';
  return 'locked';
}

function turnText(tech: TechDef, model: TechTreeModel, state: ReturnType<typeof stateOf>): string {
  if (state === 'known' || tech.cost <= 0) return 'Known';
  const banked = !model.researching || model.researching === tech.id ? model.points : 0;
  const turns = turnsToFinish(tech.cost, banked, model.rate);
  if (turns == null) return `${tech.cost} pts · no income yet`;
  if (turns === 0) return `${tech.cost} pts · ready now`;
  return `${tech.cost} pts · ${turns} turn${turns === 1 ? '' : 's'}`;
}

function chainIds(id: string | null): Set<string> {
  const ids = new Set<string>();
  if (!id) return ids;
  ids.add(id);
  for (const ancestor of ancestorIds(id)) ids.add(ancestor);
  for (const child of descendantIds(id)) ids.add(child);
  return ids;
}

export function renderTechTree(model: TechTreeModel): string {
  const layout = layoutTechTree();
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const selectedChain = chainIds(model.selected);
  const ahead = new Set(model.researching ? descendantIds(model.researching) : []);
  const queued = new Set(model.queue);
  const focused = model.selected ?? model.researching;

  const edges = TECHS.flatMap((tech) => {
    const to = byId.get(tech.id);
    if (!to) return [];
    return tech.requires.flatMap((req) => {
      const from = byId.get(req);
      if (!from) return [];
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const bend = Math.max(28, (x2 - x1) / 2);
      const hot = selectedChain.has(req) && selectedChain.has(tech.id);
      const path = queued.has(req) && queued.has(tech.id);
      const forward = model.researching === req || (model.researching != null && ahead.has(tech.id) && (ahead.has(req) || model.researching === req));
      const classes = ['tech-edge', hot ? 'is-chain' : '', path ? 'is-path' : '', forward ? 'is-ahead' : '']
        .filter(Boolean)
        .join(' ');
      return [
        `<path class="${classes}" data-edge="1" data-from="${esc(req)}" data-to="${esc(tech.id)}" d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}"/>`,
      ];
    });
  });

  const bands = layout.lanes
    .map(
      (lane) =>
        `<rect class="tech-lane lane-${lane.id}" x="0" y="${lane.y}" width="${layout.width}" height="${lane.h}"></rect><text class="tech-lane-label" x="14" y="${lane.y + 16}">${esc(lane.label)}</text>`,
    )
    .join('');

  const nodes = TECHS.map((tech) => {
    const box = byId.get(tech.id);
    if (!box) return '';
    const state = stateOf(tech, model);
    const origin = model.origins[tech.id];
    const ancestors = ancestorIds(tech.id).join(',');
    const descendants = descendantIds(tech.id).join(',');
    const classes = [
      'tech-node',
      `lane-${tech.lane}`,
      `state-${state}`,
      model.researching === tech.id ? 'is-current' : '',
      ahead.has(tech.id) ? 'is-ahead' : '',
      model.selected && selectedChain.has(tech.id) ? 'is-chain' : '',
      model.goal === tech.id ? 'is-goal' : '',
      queued.has(tech.id) ? 'is-path' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const step = model.queue.indexOf(tech.id);
    const badge = step >= 0 ? `<span class="tech-step">${step + 1}</span>` : '';
    const originTag =
      origin === 'espionage' ? '<span class="tech-origin">Stolen</span>' : origin === 'treaty' ? '<span class="tech-origin">Treaty</span>' : '';
    const unlock = tech.unlocks[0]?.name ?? 'Opens the next step';
    const extra = tech.unlocks.length > 1 ? ` +${tech.unlocks.length - 1}` : '';
    const pct =
      state === 'researching' && tech.cost > 0 ? Math.max(4, Math.min(100, Math.round((model.points / tech.cost) * 100))) : 0;
    const progress =
      state === 'researching'
        ? `<span class="tech-progress" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="tech-progress-label">${model.points}/${tech.cost}</span>`
        : '';
    return `<button type="button" class="${classes}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px" data-action="tech-node" data-tech="${esc(tech.id)}" data-testid="tech-node-${esc(tech.id)}" data-state="${state}" data-ancestors="${esc(ancestors)}" data-descendants="${esc(descendants)}" title="${esc(tech.name)}">
      ${badge}${originTag}
      <span class="tech-era">${esc(eraLabel(tech.era))} · ${esc(laneLabel(tech.lane))}</span>
      <span class="tech-name">${esc(tech.name)}</span>
      <span class="tech-meta">${esc(turnText(tech, model, state))}</span>
      <span class="tech-unlock">${esc(unlock)}${esc(extra)}</span>
      ${progress}
    </button>`;
  }).join('');

  const current = model.researching ? techById(model.researching) : undefined;
  const goal = model.goal ? techById(model.goal) : undefined;
  const pathLine = model.queue.length
    ? `<p data-testid="tech-path">Path: ${model.queue.map((id, index) => `${index + 1}. ${esc(techById(id)?.name ?? id)}`).join(' → ')}</p>`
    : '';
  const notice = model.notice ? `<p class="tech-notice" data-testid="research-notice">${esc(model.notice)}</p>` : '';

  return `<div class="modal-back"><div class="modal tech-tree-modal" data-testid="tech-tree">
    <div class="tech-tree-head">
      <div>
        <p class="eyebrow">Research</p>
        <h2>Tech tree</h2>
      </div>
      <p class="tech-tree-status">${model.points} banked · ${model.rate > 0 ? `${model.rate}/turn` : 'no research income yet'}${current ? ` · now ${esc(current.name)}` : ''}${goal ? ` · goal ${esc(goal.name)}` : ''}</p>
      <div class="tech-tree-tools">
        <button type="button" class="btn small" data-action="tree-zoom-out" data-testid="tree-zoom-out">−</button>
        <button type="button" class="btn small" data-action="tree-zoom-in" data-testid="tree-zoom-in">+</button>
        <button type="button" class="btn small" data-action="tree-fit" data-testid="tree-fit">Fit</button>
        <button type="button" class="btn small" data-action="close" data-testid="tech-tree-close">Close</button>
      </div>
    </div>
    ${notice}
    ${pathLine}
    <div class="tech-tree-body">
      <div class="tech-tree-viewport" data-testid="tech-tree-viewport">
        <div class="tech-canvas${model.selected ? ' has-focus' : ''}" data-testid="tech-canvas" style="width:${layout.width}px;height:${layout.height}px;--tree-zoom:${model.cam.zoom};transform:translate(${model.cam.x}px, ${model.cam.y}px) scale(${model.cam.zoom})">
          <svg class="tech-edges" data-testid="tech-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true">${bands}${edges.join('')}</svg>
          ${nodes}
        </div>
      </div>
      ${renderDetail(focused, model)}
    </div>
    <p class="muted tech-legend">Known, researching, available, and locked. Gold outline is the prerequisite chain and everything it leads to. Press T to open or close. Drag to pan, scroll to zoom. A stolen tech is marked Stolen. A tech copied by a research treaty is marked Treaty.</p>
  </div></div>`;
}

function renderDetail(id: string | null, model: TechTreeModel): string {
  const tech = id ? techById(id) : undefined;
  if (!tech) {
    return `<aside class="tech-detail" data-testid="tech-detail">
      <h3>Choose a technology</h3>
      <p>Click a technology you can study to start it. Click a locked one to queue every prerequisite in order.</p>
      <p class="muted">While something is being researched, the techs it leads to stay highlighted, including the other prerequisites they still need.</p>
    </aside>`;
  }
  const state = stateOf(tech, model);
    const children = descendantIds(tech.id);
    const downstream = children
      .map((child) => {
        const def = techById(child);
        if (!def) return '';
        const missing = def.requires.filter((req) => !model.known.includes(req));
        const needs = model.known.includes(child)
          ? 'known'
          : missing.length
            ? `still needs ${missing.map((req) => techById(req)?.name ?? req).join(', ')}`
            : 'ready';
        return `<li><b>${esc(def.name)}</b> — ${esc(needs)}</li>`;
      })
      .join('');
  const prereqs = tech.requires
    .map((req) => {
      const name = techById(req)?.name ?? req;
      const done = model.known.includes(req) ? 'known' : 'needed';
      return `<li>${esc(name)} — ${done}</li>`;
    })
    .join('');
  const unlocks = tech.unlocks
    .map((unlock) => `<li><span class="tech-kind">${esc(unlock.kind)}</span> ${esc(unlock.name)}</li>`)
    .join('');
  const origin = model.origins[tech.id];
  const originLine =
    origin === 'espionage'
      ? '<p class="tech-origin-line">Gained by espionage.</p>'
      : origin === 'treaty'
        ? '<p class="tech-origin-line">Gained by a research treaty.</p>'
        : origin === 'start'
          ? '<p class="tech-origin-line">Known from the start.</p>'
          : origin === 'research'
            ? '<p class="tech-origin-line">Researched.</p>'
            : '';
  const action =
    state === 'available'
      ? `<button type="button" class="btn primary" data-action="tech-research" data-tech="${esc(tech.id)}" data-testid="tech-research">Research this</button>`
      : state === 'locked'
        ? `<button type="button" class="btn primary" data-action="tech-goal" data-tech="${esc(tech.id)}" data-testid="tech-goal">Queue prerequisite path</button>`
        : state === 'researching'
          ? '<p class="muted">This is the current research.</p>'
          : '<p class="muted">Already known.</p>';
  return `<aside class="tech-detail" data-testid="tech-detail">
    <p class="eyebrow">${esc(eraLabel(tech.era))} · ${esc(laneLabel(tech.lane))}</p>
    <h3>${esc(tech.name)}</h3>
    <p>${esc(tech.blurb)}</p>
    <p class="tech-meta">${esc(turnText(tech, model, state))}</p>
    ${originLine}
    ${tech.crossFaction ? '<p class="muted">Cross-faction. A research treaty can copy this once you have the prerequisites and a partner already knows it.</p>' : ''}
    <h4>Unlocks</h4>
    <ul>${unlocks}</ul>
    <h4>Prerequisites</h4>
    ${prereqs ? `<ul>${prereqs}</ul>` : '<p class="muted">None.</p>'}
    <h4>Leads to</h4>
    ${downstream ? `<ul>${downstream}</ul>` : '<p class="muted">Nothing further on this branch.</p>'}
    ${action}
  </aside>`;
}

function eraLabel(era: TechDef['era']): string {
  if (era === 'early') return 'Early';
  if (era === 'mid') return 'Mid';
  return 'Late';
}

function laneLabel(lane: TechLane): string {
  return TECH_LANES.find((entry) => entry.id === lane)?.label ?? lane;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
