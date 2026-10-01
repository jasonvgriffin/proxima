import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const shotDir = path.join(process.cwd(), 'docs', 'screenshots');

interface UnitSnap {
  factionId: string;
  role: string;
  x: number;
  y: number;
  attack: number;
}

interface StateSnap {
  playerFaction: string;
  units: UnitSnap[];
}

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
}

async function dismissTechTree(page: Page) {
  const tree = page.getByTestId('tech-tree');
  if (await tree.count()) await page.getByTestId('tech-tree-close').click();
}

async function state(page: Page): Promise<StateSnap> {
  return page.evaluate(() => window.__proximaDebug!.state() as StateSnap);
}

test('starts a game, moves, founds, terraforms, saves, and opens diplomacy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-menu')).toBeVisible();
  await shot(page, 'start-menu');

  await page.getByTestId('menu-audio').click();
  const audioPanel = page.getByTestId('audio-panel');
  await expect(audioPanel).toBeVisible();
  await expect(audioPanel.getByTestId('audio-settings')).toBeVisible();
  await expect(audioPanel.getByTestId('audio-music')).toBeChecked();
  await expect(audioPanel.getByTestId('audio-sfx')).toBeChecked();
  await expect(audioPanel.getByTestId('audio-mute')).not.toBeChecked();
  await expect(audioPanel.getByTestId('audio-volume-master')).toBeVisible();
  await expect(audioPanel.getByTestId('audio-volume-music')).toBeVisible();
  await expect(audioPanel.getByTestId('audio-volume-sfx')).toBeVisible();
  await expect(audioPanel.getByTestId('audio-volume-ambient')).toBeVisible();
  await expect(audioPanel.getByTestId('audio-track')).toHaveValue('title');
  await expect(audioPanel.getByTestId('music-credits')).toContainText('Music: SRG774, Cleyton Kauffman, vitalezzz (CC0, OpenGameArt)');
  await expect(audioPanel.getByTestId('audio-mode')).toHaveValue('loop');
  await audioPanel.getByTestId('audio-mute').check();
  await expect(audioPanel.getByTestId('audio-music')).toBeChecked();
  await expect(audioPanel.getByTestId('audio-volume-master')).toHaveValue('0.8');
  await expect(audioPanel.getByTestId('audio-volume-ambient')).toHaveValue('0.25');
  await page.getByTestId('audio-close').click();
  await expect(page.getByTestId('audio-panel')).toHaveCount(0);

  await page.getByTestId('play-intro').click();
  await expect(page.getByTestId('intro-back')).toBeDisabled();
  await expect(page.getByTestId('intro-text')).toContainText('seeding fleet');
  await expect(page.getByTestId('intro-skip')).toBeVisible();
  await shot(page, 'intro');
  await page.getByTestId('intro-next').click();
  await expect(page.getByTestId('intro-text')).toContainText('do not wait for revision');
  await page.getByTestId('intro-exit').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();

  await page.getByTestId('new-game').click();
  await page.getByTestId('faction-helm').click();
  await page.getByTestId('open-profile').click();
  await expect(page.getByTestId('profile-screen')).toContainText('The Helm');
  await shot(page, 'faction-profile');
  await page.getByTestId('profile-back').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('calendar')).toHaveText('Year 2460, Week 1');
  await page.waitForTimeout(40);
  await shot(page, 'main-map');

  await page.locator('[data-testid="unit-list"] [data-role="scout"]').click();
  const scout = (await state(page)).units.find((unit) => unit.role === 'scout' && unit.factionId === 'helm');
  expect(scout).toBeTruthy();
  const destination = { x: scout!.x + 1, y: scout!.y };
  const point = await page.evaluate(({ x, y }) => window.__proximaDebug!.tilePoint(x, y), destination);
  expect(point).toBeTruthy();
  await page.mouse.click(point!.x, point!.y);
  await expect.poll(async () => (await state(page)).units.find((unit) => unit.role === 'scout' && unit.factionId === 'helm')?.x).toBe(destination.x);

  await page.locator('[data-testid="unit-list"] [data-role="settler"]').click();
  await page.getByTestId('found-city').click();
  await expect(page.getByTestId('city-list')).not.toContainText('No cities');

  await page.locator('[data-testid="unit-list"] [data-role="terraformer"]').click();
  await page.getByTestId('terraform-open').click();
  await expect(page.getByTestId('terraform-menu')).toBeVisible();
  await page.getByTestId('terraform-farm').click();
  await expect(page.getByTestId('unit-list')).toContainText('working');

  await page.getByTestId('end-turn').click();
  await expect(page.getByTestId('calendar')).toHaveText('Year 2460, Week 2');
  await dismissTechTree(page);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await expect(page.getByTestId('audio-settings')).toBeVisible();
  await expect(page.getByTestId('music-credits')).toContainText('Music: SRG774, Cleyton Kauffman, vitalezzz (CC0, OpenGameArt)');
  await expect(page.getByTestId('audio-mute')).toBeChecked();
  await expect(page.getByTestId('audio-music')).toBeChecked();
  await page.getByTestId('audio-mute').uncheck();
  await expect(page.getByTestId('autosave-toggle')).toBeVisible();
  await shot(page, 'pause-menu');
  await page.getByTestId('pause-save').click();
  await page.getByTestId('save-slot-1').click();
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await page.getByTestId('pause-resume').click();

  await page.getByTestId('end-turn').click();
  await expect(page.getByTestId('calendar')).toHaveText('Year 2460, Week 3');
  await dismissTechTree(page);
  await page.keyboard.press('Escape');
  await page.getByTestId('pause-load').click();
  await page.getByTestId('load-slot-1').click();
  await expect(page.getByTestId('calendar')).toHaveText('Year 2460, Week 2');
  await expect(page.getByTestId('city-list')).not.toContainText('No cities');

  await page.getByTestId('open-diplomacy').click();
  await expect(page.getByTestId('diplomacy-screen')).toContainText('non-aggression');
  await shot(page, 'diplomacy');
  await page.getByTestId('diplomacy-screen').getByRole('button', { name: 'Close' }).click();

  await page.getByTestId('open-spies').click();
  await expect(page.getByTestId('recruit-spy')).toBeVisible();
  await shot(page, 'spies');
  await page.getByTestId('spy-screen').getByRole('button', { name: 'Close' }).click();

  const raider = await page.evaluate(() => window.__proximaDebug!.spawnRaider());
  expect(raider).toBeTruthy();
  await page.getByTestId('attack-btn').click();
  await expect(page.getByTestId('combat-odds')).toHaveText(/\d+%/);
  await shot(page, 'combat-odds');
  await page.getByTestId('combat-cancel').click();
  await expect(page.getByTestId('combat-modal')).toHaveCount(0);
});
