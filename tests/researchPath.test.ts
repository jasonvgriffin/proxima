import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import {
  advanceResearchQueue,
  ancestorIds,
  descendantIds,
  nextQueuedResearch,
  pathToGoal,
  treatyTechGrants,
  turnsToFinish,
  unmetPrereqs,
} from '../src/core/researchPath';
import { TECHS, startingTechs, techById } from '../src/core/tech';
import { layoutTechTree, renderTechTree } from '../src/ui/techtree';

describe('path to a research goal', () => {
  it('orders prerequisites before the goal and skips technologies already known', () => {
    const known = startingTechs('helm');
    const path = pathToGoal('coil-weapons', known);
    expect(path).toEqual(['weapons', 'coil-weapons']);
    expect(pathToGoal('governance', known)).toEqual([]);
    expect(pathToGoal('missing-tech', known)).toBeNull();
  });

  it('puts every prerequisite earlier in the path, including a diamond', () => {
    const path = pathToGoal('planetary-supremacy', []);
    expect(path).not.toBeNull();
    const index = new Map(path!.map((id, place) => [id, place]));
    expect(index.get('planetary-supremacy')).toBe(path!.length - 1);
    for (const id of path!) {
      const tech = techById(id)!;
      for (const req of tech.requires) {
        if (index.has(req)) expect(index.get(req)).toBeLessThan(index.get(id)!);
      }
    }
    expect(index.get('shock-doctrine')).toBeLessThan(index.get('planetary-supremacy')!);
    expect(index.get('siege-craft')).toBeLessThan(index.get('planetary-supremacy')!);
  });

  it('advances the queue and names descendants that still need other prerequisites', () => {
    const queue = ['weapons', 'coil-weapons', 'plasma-lance'];
    expect(nextQueuedResearch(queue, [])).toBe('weapons');
    expect(nextQueuedResearch(queue, ['weapons'])).toBe('coil-weapons');
    const faction = { techs: ['weapons', 'coil-weapons'], researchGoal: 'plasma-lance', researchQueue: [...queue] };
    expect(advanceResearchQueue(faction)).toBe('plasma-lance');
    expect(faction.researchQueue).toEqual(['plasma-lance']);

    const ahead = descendantIds('coil-weapons');
    expect(ahead).toContain('plasma-lance');
    expect(ahead).toContain('siege-craft');
    expect(ancestorIds('coil-weapons')).toEqual(['weapons']);
    const missing = unmetPrereqs('siege-craft', ['coil-weapons']);
    expect(missing).toContain('fortification');
    expect(missing).not.toContain('coil-weapons');
  });

  it('copies a cross-faction tech only when a treaty partner already knows it', () => {
    const known = ['medicine', 'sensors'];
    expect(treatyTechGrants(known, [['biology']])).toEqual([]);
    expect(treatyTechGrants(known, [['mnemonic-weave']])).toEqual(['mnemonic-weave']);
    expect(turnsToFinish(70, 20, 10)).toBe(5);
    expect(turnsToFinish(70, 70, 0)).toBe(0);
    expect(turnsToFinish(70, 0, 0)).toBeNull();
  });
});

describe('the tech tree catalog', () => {
  it('has more than forty technologies across the five branches, with no broken links', () => {
    expect(TECHS.length).toBeGreaterThanOrEqual(40);
    const lanes = new Set(TECHS.map((tech) => tech.lane));
    for (const lane of ['exploration', 'growth', 'industry', 'conquest', 'discovery']) {
      expect(lanes.has(lane as 'exploration')).toBe(true);
    }
    const ids = new Set(TECHS.map((tech) => tech.id));
    expect(ids.size).toBe(TECHS.length);
    for (const tech of TECHS) {
      for (const req of tech.requires) {
        expect(ids.has(req)).toBe(true);
        expect(techById(req)!.column).toBeLessThan(tech.column);
      }
      expect(tech.unlocks.length).toBeGreaterThan(0);
    }
    const sealed = techById('sealed-habitats');
    expect(sealed?.requires).toEqual(['advanced-formers', 'atmosphere']);
    expect(sealed?.era).toBe('late');
    const visiting = new Set<string>();
    const visitingOrder: string[] = [];
    const walk = (id: string) => {
      expect(visiting.has(id)).toBe(false);
      visiting.add(id);
      visitingOrder.push(id);
      for (const child of TECHS.filter((tech) => tech.requires.includes(id))) walk(child.id);
      visiting.delete(id);
    };
    for (const tech of TECHS.filter((entry) => entry.requires.length === 0)) walk(tech.id);
    expect(new Set(visitingOrder).size).toBe(TECHS.length);
  });

  it('lays nodes out with connecting lines and draws the goal path', () => {
    const layout = layoutTechTree();
    expect(layout.nodes).toHaveLength(TECHS.length);
    const at = new Map(layout.nodes.map((node) => [node.id, node]));
    for (const tech of TECHS) {
      for (const req of tech.requires) {
        expect(at.get(req)!.x).toBeLessThan(at.get(tech.id)!.x);
      }
    }
    const html = renderTechTree({
      points: 12,
      rate: 4,
      known: startingTechs('helm'),
      researching: 'weapons',
      goal: 'coil-weapons',
      queue: ['weapons', 'coil-weapons'],
      origins: { governance: 'start', 'field-formers': 'start' },
      selected: 'coil-weapons',
      notice: 'Research complete: Basic Weapons unlocks Coil guns',
      cam: { x: 0, y: 0, zoom: 1 },
    });
    expect(html).toContain('data-testid="tech-tree"');
    expect(html).toContain('<svg');
    expect(html.match(/<path /g)?.length).toBeGreaterThanOrEqual(TECHS.reduce((sum, tech) => sum + tech.requires.length, 0));
    expect(html).toContain('data-testid="tech-node-sealed-habitats"');
    expect(html).toContain('data-testid="research-notice"');
    expect(html).toContain('Research complete: Basic Weapons unlocks Coil guns');
    expect(html).toContain('is-current');
    expect(html).toContain('is-chain');
    expect(html).toContain('still needs');
  });
});

describe('research goals in a game', () => {
  it('starts the first prerequisite and continues the queue when it finishes', () => {
    const game = Game.newGame({ seed: 4, player: 'helm' });
    const set = game.setResearchGoal('coil-weapons');
    expect(set.ok).toBe(true);
    expect(set.message).toContain('Basic Weapons');
    const helm = game.state.factions.helm;
    expect(helm.researching).toBe('weapons');
    expect(helm.researchQueue).toEqual(['weapons', 'coil-weapons']);
    helm.researchPoints = 500;
    expect(game.chooseResearch('weapons').ok).toBe(true);
    expect(helm.techs).toContain('weapons');
    expect(helm.techOrigins.weapons).toBe('research');
    expect(helm.researching).toBe('coil-weapons');
    expect(helm.researchGoal).toBe('coil-weapons');
  });

  it('marks a stolen technology as espionage and keeps AI research running', () => {
    const game = Game.newGame({ seed: 8, player: 'helm' });
    game.recruitSpy();
    const spy = game.state.spies[0];
    game.placeSpy(spy.id, 'ironclad');
    const stolen = game.resolveTheft(spy.id, 'weapons', 0.99);
    expect(stolen.ok).toBe(true);
    expect(game.state.factions.helm.techOrigins.weapons).toBe('espionage');

    game.endTurn();
    const rivals = (['verdantia', 'genesis', 'ironclad', 'mnemosyne', 'clio'] as const).filter(
      (id) => game.state.factions[id].researching,
    );
    expect(rivals.length).toBeGreaterThan(0);
  });

  it('fills research fields when an older save omits them', () => {
    const game = Game.newGame({ seed: 5, player: 'helm' });
    const state = game.serialize();
    const helm = state.factions.helm as { researchGoal?: string | null; researchQueue?: string[]; techOrigins?: Record<string, string> };
    delete helm.researchGoal;
    delete helm.researchQueue;
    delete helm.techOrigins;
    const loaded = Game.fromState(state);
    expect(loaded.state.factions.helm.researchGoal).toBeNull();
    expect(loaded.state.factions.helm.researchQueue).toEqual([]);
    expect(loaded.state.factions.helm.techOrigins.governance).toBe('start');
  });
});
