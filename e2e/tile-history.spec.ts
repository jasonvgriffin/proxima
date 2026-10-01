import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const shotDir = path.join(process.cwd(), 'docs', 'screenshots');
const artifactDir = '/opt/cursor/artifacts';

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
});

async function shot(page: Page, name: string) {
  const file = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: file });
  fs.copyFileSync(file, path.join(artifactDir, `${name}.png`));
}

test('clicks a terraformed tile and shows its improvements and history', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('faction-helm').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();

  await page.locator('[data-testid="unit-list"] [data-role="terraformer"]').click();
  await page.getByTestId('terraform-open').click();
  await page.getByTestId('terraform-farm').click();
  await expect(page.getByTestId('unit-list')).toContainText('working');

  const finished = await page.evaluate(() => window.__proximaDebug!.finishTerraform());
  expect(finished).toBeTruthy();
  const point = await page.evaluate(({ x, y }) => window.__proximaDebug!.tilePoint(x, y), finished!);
  expect(point).toBeTruthy();
  await page.keyboard.down('Shift');
  await page.mouse.click(point!.x, point!.y);
  await page.keyboard.up('Shift');

  await expect(page.getByTestId('tile-panel')).toBeVisible();
  await expect(page.getByTestId('tile-improvements')).toContainText('Farm');
  await expect(page.getByTestId('tile-history')).toContainText('farm');
  await expect(page.getByTestId('tile-yields')).toContainText('nutrients');
  await shot(page, 'tile-history');
});
