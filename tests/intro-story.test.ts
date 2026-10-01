import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/factions';
import { INTRO_SCENES } from '../src/render/intro';

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0);
}

describe('introduction story', () => {
  it('runs eight to twelve scenes of two to four sentences', () => {
    expect(INTRO_SCENES.length).toBeGreaterThanOrEqual(8);
    expect(INTRO_SCENES.length).toBeLessThanOrEqual(12);
    for (const scene of INTRO_SCENES) {
      const count = sentences(scene.text).length;
      expect(count, scene.title).toBeGreaterThanOrEqual(2);
      expect(count, scene.title).toBeLessThanOrEqual(4);
      expect(scene.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('names each faction and does not depend on a habitable band', () => {
    const all = INTRO_SCENES.map((scene) => `${scene.title} ${scene.text}`).join('\n');
    for (const name of ['The Helm', 'Verdantia', 'Genesis', 'Ironclad', 'Mnemosyne', 'Clio']) {
      expect(all).toContain(name);
    }
    expect(all.toLowerCase()).not.toMatch(/twilight|habitable band|habitable zone/);
    expect(all).toContain('Halcyon');
    expect(all).toContain('Depart, do not wait for revision');
  });

  it('matches the saved script and the faction profiles', () => {
    const doc = fs.readFileSync('docs/intro-story.md', 'utf8');
    for (const scene of INTRO_SCENES) {
      expect(doc).toContain(`## ${INTRO_SCENES.indexOf(scene) + 1}. ${scene.title}`);
      expect(doc).toContain(scene.text);
    }
    expect(FACTIONS.helm.backstory).toContain('Nesta Quill');
    expect(FACTIONS.verdantia.backstory).toContain('Pellin Moss');
    expect(FACTIONS.genesis.backstory).toContain('Juniper Vale');
    expect(FACTIONS.ironclad.backstory).toContain('Calder Venn');
    expect(FACTIONS.mnemosyne.backstory).toContain('Orla Vesper');
    expect(FACTIONS.clio.backstory).toContain('Wren Solace');
    expect(FACTIONS.helm.backstory.toLowerCase()).not.toMatch(/twilight/);
    expect(FACTIONS.helm.backstory).toContain('Depart, do not wait for revision');
    expect(FACTIONS.verdantia.backstory).toContain('Lahore');
    expect(FACTIONS.genesis.backstory).toContain('DNA archive');
    expect(FACTIONS.ironclad.backstory).toContain('separation bolts');
    expect(FACTIONS.mnemosyne.backstory).toContain('Shackleton locks');
    expect(FACTIONS.clio.backstory).toContain('Muse of history');
    for (const faction of Object.values(FACTIONS)) {
      expect(faction.backstory.length).toBeGreaterThan(500);
      expect(faction.backstory.toLowerCase()).not.toMatch(/twilight|habitable band/);
      expect(faction.playsLike).toContain(faction.freeTechName);
      expect(faction.playsLike.length).toBeGreaterThan(80);
    }
  });
});
