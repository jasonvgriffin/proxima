import { describe, expect, it } from 'vitest';
import { LEADERS, leaderGreeting } from '../src/art/leaders';
import { drawPortrait } from '../src/art/portraits';
import { FACTIONS } from '../src/core/factions';
import { FACTION_IDS, type FactionId, type Stance } from '../src/core/types';
import { diplomacyMarkup } from '../src/ui/app';

const STANCES: Stance[] = ['war', 'peace', 'nap', 'alliance'];

describe('faction leaders and portraits', () => {
  it('gives every faction a named leader and a stance-specific greeting', () => {
    const names = new Set<string>();
    for (const id of FACTION_IDS) {
      const leader = LEADERS[id];
      expect(leader.name.trim().length).toBeGreaterThan(0);
      expect(leader.title.trim().length).toBeGreaterThan(0);
      expect(leader.line.trim().length).toBeGreaterThan(0);
      names.add(leader.name);
      for (const stance of STANCES) expect(leaderGreeting(id, stance).trim().length).toBeGreaterThan(0);
      expect(leaderGreeting(id, 'war')).not.toBe(leaderGreeting(id, 'alliance'));
      expect(leaderGreeting(id, 'peace')).not.toBe(leaderGreeting(id, 'nap'));
    }
    expect(names.size).toBe(FACTION_IDS.length);
  });

  it('renders a distinct portrait for every faction', () => {
    const seen = new Set<string>();
    for (const id of FACTION_IDS) {
      const { ctx, paints } = mockContext();
      drawPortrait(ctx, id, 220, 286);
      expect(paints.filter((paint) => paint === 'fill' || paint === 'stroke').length).toBeGreaterThan(8);
      const signature = paints.join('|');
      expect(seen.has(signature)).toBe(false);
      seen.add(signature);
    }
  });
});

describe('diplomacy screen', () => {
  const others = FACTION_IDS.filter((id) => id !== 'helm');

  function rows(contacted: FactionId[] = []) {
    return others.map((id) => ({
      id,
      name: FACTIONS[id].name,
      leader: LEADERS[id].name,
      stance: (id === 'ironclad' ? 'war' : 'peace') as Stance,
      memory: 1,
      research: false,
      exploration: true,
      contacted: contacted.includes(id),
    }));
  }

  it('opens on a picker of names and portraits, with a small Close at the top', () => {
    const html = diplomacyMarkup({
      offers: [{ id: 3, from: 'verdantia', fromName: FACTIONS.verdantia.name, kind: 'nap', label: 'a non-aggression pact' }],
      focus: null,
      factions: rows(['verdantia']),
    });
    expect(html).toContain('data-testid="diplomacy-picker"');
    expect(html.indexOf('data-testid="diplomacy-close"')).toBeLessThan(html.indexOf('data-testid="diplomacy-picker"'));
    expect(html).toContain('class="btn small diplomacy-close"');
    expect(html).toContain('No contact yet');
    expect(html).toContain('data-testid="diplomacy-offer"');
    expect(html).not.toContain('data-testid="diplomacy-detail"');
    for (const id of others) {
      expect(html).toContain(`data-testid="diplomat-${id}"`);
      expect(html).toContain(`data-portrait="${id}"`);
      expect(html).toContain(`data-emblem="${id}"`);
      expect(html).toContain(FACTIONS[id].name);
      expect(html).toContain(LEADERS[id].name);
    }
    expect(html).toContain('data-action="select-diplomat" data-faction="verdantia"');
    expect(html).toContain('data-testid="diplomat-ironclad" disabled');
    const offerCrests = [...html.matchAll(/data-testid="diplomacy-offer"[\s\S]*?data-emblem="([^"]+)"/g)].map((match) => match[1]);
    expect(offerCrests).toEqual(['verdantia']);
  });

  it('shows the leader portrait, profile, and diplomacy options after a faction is chosen', () => {
    const html = diplomacyMarkup({
      offers: [],
      focus: {
        factionId: 'ironclad',
        factionName: FACTIONS.ironclad.name,
        leader: LEADERS.ironclad.name,
        title: LEADERS.ironclad.title,
        line: LEADERS.ironclad.line,
        idea: FACTIONS.ironclad.idea,
        greeting: leaderGreeting('ironclad', 'war'),
        stance: 'war',
        memory: 4,
        research: false,
        exploration: true,
      },
      factions: rows(['ironclad']),
    });
    expect(html).toContain('data-testid="diplomacy-detail"');
    expect(html).toContain(`data-portrait="ironclad"`);
    expect(html).toContain(LEADERS.ironclad.line);
    expect(html).toContain(FACTIONS.ironclad.idea);
    expect(html).toContain(leaderGreeting('ironclad', 'war'));
    expect(html).toContain('Declare war');
    expect(html).toContain('Non-aggression');
    expect(html).toContain('data-testid="trade-ironclad"');
    expect(html).toContain('data-testid="diplomacy-back"');
    expect(html).not.toContain('data-testid="diplomacy-picker"');
  });
});

function mockContext() {
  const paints: string[] = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    rect() {},
    clip() {},
    fill() {
      paints.push('fill');
      paints.push(typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient');
    },
    stroke() {
      paints.push('stroke');
      paints.push(String(this.strokeStyle));
    },
    fillRect() {
      paints.push('fill');
    },
    strokeRect() {
      paints.push('stroke');
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, paints };
}
