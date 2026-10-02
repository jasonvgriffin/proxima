import type { App } from '../app';
import { paintUnitIcon, unitKindFor } from '../../art/units';
import { FACTIONS } from '../../core/factions';
import { TECHS, techAvailable, techById } from '../../core/tech';
import { renderTechTree } from '../techtree';
import { CHASSIS, WEAPONS, ARMORS, SPECIALS, partKnown } from '../../core/parts';
import { esc } from '../text';

export function pickTech(this: App, id: string, action: string) {
  const game = this.game;
  if (!game) return;
  this.treeSelected = id;
  const faction = game.state.factions[game.state.playerFaction];
  const tech = techById(id);
  if (!tech || faction.techs.includes(id)) return;
  if (action === 'tech-goal' || !techAvailable(tech, faction.techs)) this.act(() => game.setResearchGoal(id), 'click');
  else this.act(() => game.chooseResearch(id), 'click');
}

export function openTechTree(this: App) {
  const game = this.game;
  if (!game) return;
  const faction = game.state.factions[game.state.playerFaction];
  this.overlay.innerHTML = renderTechTree({
    points: faction.researchPoints,
    rate: game.ratesFor(game.state.playerFaction).research,
    known: faction.techs,
    researching: faction.researching,
    goal: faction.researchGoal,
    queue: faction.researchQueue ?? [],
    origins: faction.techOrigins ?? {},
    selected: this.treeSelected,
    notice: this.treeNotice,
    cam: this.treeCam,
  });
  if (!this.treeDidFit) {
    requestAnimationFrame(() => {
      if (!this.overlay.querySelector('[data-testid="tech-tree"]')) return;
      this.fitTree();
      this.treeDidFit = true;
    });
  }
}

export function applyTreeCam(this: App) {
  const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]') as HTMLElement | null;
  if (!canvas) return;
  canvas.style.setProperty('--tree-zoom', String(this.treeCam.zoom));
  canvas.style.transform = `translate(${this.treeCam.x}px, ${this.treeCam.y}px) scale(${this.treeCam.zoom})`;
}

export function fitTree(this: App) {
  const view = this.overlay.querySelector('[data-testid="tech-tree-viewport"]') as HTMLElement | null;
  const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]') as HTMLElement | null;
  if (!view || !canvas || canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;
  const zoom = Math.min(1, (view.clientWidth - 24) / canvas.offsetWidth, (view.clientHeight - 24) / canvas.offsetHeight);
  this.treeCam.zoom = Math.max(0.22, zoom);
  this.treeCam.x = 12;
  this.treeCam.y = 12;
  this.applyTreeCam();
}

export function onTreeHover(this: App, event: Event) {
  const canvas = this.overlay.querySelector('[data-testid="tech-canvas"]');
  if (!canvas) return;
  const node = (event.target as HTMLElement | null)?.closest?.('[data-tech]') as HTMLElement | null;
  canvas.classList.toggle('has-hover', !!node);
  canvas.querySelectorAll('.is-hover-chain').forEach((el) => el.classList.remove('is-hover-chain'));
  if (!node?.dataset.tech) return;
  const ids = new Set(
    [node.dataset.tech, node.dataset.ancestors ?? '', node.dataset.descendants ?? ''].join(',').split(',').filter(Boolean),
  );
  for (const id of ids) canvas.querySelector(`[data-tech="${CSS.escape(id)}"]`)?.classList.add('is-hover-chain');
  canvas.querySelectorAll('[data-edge]').forEach((edge) => {
    const from = edge.getAttribute('data-from');
    const to = edge.getAttribute('data-to');
    if (from && to && ids.has(from) && ids.has(to)) edge.classList.add('is-hover-chain');
  });
}

export function onTreePointerDown(this: App, event: PointerEvent) {
  const viewport = (event.target as HTMLElement | null)?.closest?.('[data-testid="tech-tree-viewport"]');
  if (!viewport) return;
  if ((event.target as HTMLElement | null)?.closest?.('[data-tech]')) return;
  this.treeDrag = { x: event.clientX, y: event.clientY, panX: this.treeCam.x, panY: this.treeCam.y, pointer: event.pointerId };
}

export function onTreePointerMove(this: App, event: PointerEvent) {
  if (!this.treeDrag || this.treeDrag.pointer !== event.pointerId) return;
  this.treeCam.x = this.treeDrag.panX + event.clientX - this.treeDrag.x;
  this.treeCam.y = this.treeDrag.panY + event.clientY - this.treeDrag.y;
  this.applyTreeCam();
}

export function onTreePointerUp(this: App, event: PointerEvent) {
  if (this.treeDrag?.pointer === event.pointerId) this.treeDrag = null;
}

export function onTreeWheel(this: App, event: WheelEvent) {
  if (!(event.target as HTMLElement | null)?.closest?.('[data-testid="tech-tree-viewport"]')) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.08 : 0.92;
  this.treeCam.zoom = Math.min(1.5, Math.max(0.22, this.treeCam.zoom * factor));
  this.applyTreeCam();
}

export function maybePromptResearch(this: App, before: { techs: string[]; researching: string | null }) {
  const game = this.game;
  if (!game || game.state.winner || game.state.playerTurnsCompleted < 1) return;
  const faction = game.state.factions[game.state.playerFaction];
  const completed = before.researching && faction.techs.includes(before.researching) ? before.researching : null;
  if (completed) {
    const tech = techById(completed);
    const unlocks = tech?.unlocks.map((unlock) => unlock.name).join(', ') || 'the next step';
    this.treeNotice = `Research complete: ${tech?.name ?? completed} unlocks ${unlocks}`;
    this.treeSelected = completed;
    this.openTechTree();
    return;
  }
  const available = TECHS.some((tech) => tech.cost > 0 && techAvailable(tech, faction.techs));
  if (!faction.researching && available && !this.overlay.innerHTML) {
    this.treeNotice = 'Nothing is being researched. Choose a technology, or click a locked one to queue its prerequisites.';
    this.openTechTree();
  }
}

export function openDesign(this: App) {
  const techs = this.game!.state.factions[this.game!.state.playerFaction].techs;
  const options = (parts: { id: string; name: string; req: string | null }[]) =>
    parts.filter((part) => partKnown(part.req, techs)).map((part) => `<option value="${part.id}">${esc(part.name)}</option>`).join('');
  const colors = FACTIONS[this.game!.state.playerFaction].colors;
  this.overlay.innerHTML = `
    <div class="modal-back"><div class="modal narrow">
      <h2>Design a unit</h2>
      <canvas id="design-preview" class="design-preview" data-unit-icon data-kind="infantry" data-color="${colors.main}" data-deep="${colors.deep}" width="296" height="208"></canvas>
      <label>Name <input id="design-name" value="Field design"/></label>
      <label>Chassis <select id="design-chassis">${options(CHASSIS)}</select></label>
      <label>Weapon <select id="design-weapon">${options(WEAPONS)}</select></label>
      <label>Armor <select id="design-armor">${options(ARMORS)}</select></label>
      <div class="stack">${SPECIALS.filter((part) => partKnown(part.req, techs)).map((part) => `<label><input type="checkbox" value="${part.id}" class="design-special"/> ${esc(part.name)}</label>`).join('')}</div>
      <button class="btn primary" data-action="save-design">Save design</button>
      <button class="btn" data-action="close">Close</button>
    </div></div>`;
  this.paintDesignPreview();
}

export function paintDesignPreview(this: App) {
  const canvas = this.overlay.querySelector('#design-preview') as HTMLCanvasElement | null;
  const chassis = this.overlay.querySelector('#design-chassis') as HTMLSelectElement | null;
  if (!canvas || !chassis || !this.game) return;
  const colors = FACTIONS[this.game.state.playerFaction].colors;
  canvas.dataset.kind = unitKindFor({ chassis: chassis.value });
  canvas.dataset.color = colors.main;
  canvas.dataset.deep = colors.deep;
  paintUnitIcon(canvas);
}

export function saveDesign(this: App) {
  const name = (this.overlay.querySelector('#design-name') as HTMLInputElement).value;
  const chassis = (this.overlay.querySelector('#design-chassis') as HTMLSelectElement).value;
  const weapon = (this.overlay.querySelector('#design-weapon') as HTMLSelectElement).value;
  const armor = (this.overlay.querySelector('#design-armor') as HTMLSelectElement).value;
  const specials = [...this.overlay.querySelectorAll('.design-special')].filter((box) => (box as HTMLInputElement).checked).map((box) => (box as HTMLInputElement).value);
  this.act(() => this.game!.createDesign({ name, chassis, weapon, armor, specials }), 'click');
  this.closeOverlay();
}

