import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const shotDir = path.join(process.cwd(), 'docs', 'screenshots');
const artifactDir = '/opt/cursor/artifacts';

async function shot(page: Page, name: string) {
  fs.mkdirSync(shotDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
  const file = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: file });
  fs.copyFileSync(file, path.join(artifactDir, `${name}.png`));
}

test('captures defeat, trade, event, transport, and a mid-game map', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('faction-helm').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();

  await page.evaluate(() => window.__proximaDebug!.showMidgame());
  await page.waitForTimeout(50);
  await shot(page, 'midgame-map');

  await page.evaluate(() => window.__proximaDebug!.showTransport());
  await expect(page.getByTestId('unit-list')).toContainText('carrying');
  await shot(page, 'transport-loaded');

  await page.evaluate(() => window.__proximaDebug!.showTrade());
  await expect(page.getByTestId('trade-offer')).toBeVisible();
  await shot(page, 'trade-offer');

  await page.evaluate(() => window.__proximaDebug!.showEvent());
  await expect(page.getByTestId('event-popup')).toBeVisible();
  await shot(page, 'event-popup');

  await page.evaluate(() => window.__proximaDebug!.showDefeat());
  await expect(page.getByTestId('defeat-screen')).toBeVisible();
  await expect(page.getByTestId('defeat-menu')).toBeVisible();
  await shot(page, 'defeat-screen');
});
