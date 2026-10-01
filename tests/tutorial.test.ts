import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { FACTIONS } from '../src/core/factions';
import { formatCalendar } from '../src/core/rules';
import { renderTutorial, renderTutorialPage, tutorialIndex, tutorialPages } from '../src/ui/tutorial';

const TOPICS = [
  'twilight',
  'cities',
  'economy',
  'research',
  'terraformers',
  'combat',
  'society',
  'diplomacy',
  'spies',
  'crisis',
] as const;

describe('pause tutorial', () => {
  it('teaches the core loop in order, using the live faction names', () => {
    const pages = tutorialPages();
    expect(pages.map((page) => page.id)).toEqual([...TOPICS]);
    const text = pages.map((page) => `${page.title} ${page.paragraphs.join(' ')}`).join('\n');
    for (const faction of Object.values(FACTIONS)) {
      expect(text).toContain(faction.name);
    }
    expect(text).toContain(formatCalendar(1));
    expect(text).toContain(String(CONFIG.outsideBand.damagePerTurn));
    expect(text).toContain(String(CONFIG.spies.recruitCost));
    expect(text).toContain(String(CONFIG.social.switchCost));
    expect(text).toContain(formatCalendar(CONFIG.crisis.startRound));
    expect(text).toContain('Sealed Habitats / Geothermal Wells');
    expect(text).toContain('Waking Reactor');
    expect(text).toContain('Salvage Formers');
    expect(text).toContain('optional');
    expect(text).toContain('Escape');
  });

  it('pages with Next and Back, and the last page closes instead of advancing', () => {
    const first = renderTutorial(0);
    expect(first).toContain('data-testid="tutorial"');
    expect(first).toContain('data-tutorial-step="0"');
    expect(first).toContain('The twilight band');
    expect(first).toContain('data-action="tutorial-back"');
    expect(first).toContain('disabled');
    expect(first).toContain('data-action="tutorial-next"');
    expect(first).toContain('>Next<');
    expect(first).toContain('data-testid="tutorial-close"');
    expect(first).toContain('data-action="close"');

    const second = renderTutorial(1);
    expect(second).toContain('Founding cities');
    expect(second).toContain('data-tutorial-step="1"');
    expect(second).not.toMatch(/data-action="tutorial-back"[^>]*disabled/);

    const lastIndex = tutorialPages().length - 1;
    const last = renderTutorial(lastIndex);
    expect(last).toContain('The Waking Reactor');
    expect(last).toContain('>Done<');
    expect(last).toContain('data-testid="tutorial-next"');
    expect(last).toMatch(/data-action="close"[^>]*data-testid="tutorial-next"/);

    expect(renderTutorial(-4)).toContain('data-tutorial-step="0"');
    expect(renderTutorial(99)).toContain(`data-tutorial-step="${lastIndex}"`);
    expect(tutorialIndex(Number.NaN)).toBe(0);
  });

  it('escapes page text and offers only dismiss or paging actions', () => {
    const html = renderTutorialPage(
      { id: 'probe', title: 'A < B', paragraphs: ['Tom & Jerry'] },
      0,
      2,
    );
    expect(html).toContain('A &lt; B');
    expect(html).toContain('Tom &amp; Jerry');
    expect(html).not.toContain('A < B');

    const actions = [...renderTutorial(3).matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]);
    expect(actions.sort()).toEqual(['close', 'tutorial-back', 'tutorial-next']);
  });
});
