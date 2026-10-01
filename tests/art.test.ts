import { describe, expect, it } from 'vitest';
import { LEADERS, leaderGreeting } from '../src/art/leaders';
import { drawPortrait } from '../src/art/portraits';
import { FACTIONS } from '../src/core/factions';
import { FACTION_IDS, type Stance } from '../src/core/types';
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

describe('diplomacy crests', () => {
  it('puts a crest canvas on every faction row and on incoming offers', () => {
    const others = FACTION_IDS.filter((id) => id !== 'helm');
    const html = diplomacyMarkup({
      offers: [{ id: 3, from: 'verdantia', fromName: FACTIONS.verdantia.name, kind: 'nap', label: 'a non-aggression pact' }],
      focus: {
        factionId: 'ironclad',
        factionName: FACTIONS.ironclad.name,
        leader: LEADERS.ironclad.name,
        title: LEADERS.ironclad.title,
        greeting: leaderGreeting('ironclad', 'peace'),
      },
      factions: others.map((id) => ({
        id,
        name: FACTIONS[id].name,
        leader: LEADERS[id].name,
        stance: (id === 'ironclad' ? 'war' : 'peace') as Stance,
        memory: 1,
        research: false,
        exploration: true,
        selected: id === 'ironclad',
      })),
    });

    expect(html).toContain('data-testid="diplomacy-screen"');
    expect(html).toContain('data-testid="diplomacy-offer"');
    expect(html).toContain('data-emblem="verdantia"');
    expect(html).toContain(leaderGreeting('ironclad', 'peace'));
    expect(html).toContain('Non-aggression');
    for (const id of others) {
      expect(html).toContain(`data-faction="${id}"`);
      expect(html).toContain(`data-emblem="${id}"`);
      expect(html).toContain(`data-portrait="${id}"`);
      expect(html).toContain(LEADERS[id].name);
    }

    const rowCrests = [...html.matchAll(/class="diplomacy-head[^"]*"[\s\S]*?<canvas data-emblem="([^"]+)"/g)].map((match) => match[1]);
    expect(rowCrests).toEqual([...others]);
    const offerCrests = [...html.matchAll(/data-testid="diplomacy-offer"[\s\S]*?data-emblem="([^"]+)"/g)].map((match) => match[1]);
    expect(offerCrests).toEqual(['verdantia']);
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
