import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEADERS, leaderGreeting } from '../src/art/leaders';
import { leaderPortraitUrl } from '../src/art/portraits';
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

  it('ships a distinct square portrait for every leader', () => {
    const urls = new Set<string>();
    for (const id of FACTION_IDS) {
      const url = leaderPortraitUrl(id);
      expect(url.endsWith(`portraits/${id}.webp`)).toBe(true);
      expect(urls.has(url)).toBe(false);
      urls.add(url);
      const buf = fs.readFileSync(`public/portraits/${id}.webp`);
      expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(buf.length).toBeGreaterThan(8 * 1024);
      expect(buf.length).toBeLessThan(80 * 1024);
      expect(webpSize(buf)).toEqual([512, 512]);
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

function webpSize(buf: Buffer): [number, number] {
  const kind = buf.subarray(12, 16).toString('ascii');
  if (kind === 'VP8X') {
    return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  if (kind === 'VP8 ') {
    const start = buf.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
    if (start >= 0) return [buf.readUInt16LE(start + 3) & 0x3fff, buf.readUInt16LE(start + 5) & 0x3fff];
  }
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  throw new Error(`Unknown WebP chunk ${kind}`);
}

