import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const shotDir = path.join(process.cwd(), 'docs', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
});

test('opens the tech tree from the top bar without a selected unit', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('faction-helm').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('calendar')).toHaveText('Year 2460, Week 1');
  await expect(page.getByTestId('open-research')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/tech-tree-topbar.png' });

  await page.getByTestId('open-research').click();
  const tree = page.getByTestId('tech-tree');
  await expect(tree).toBeVisible();
  await expect(tree.locator('[data-testid="tech-edges"] path')).not.toHaveCount(0);
  await expect(page.getByTestId('tech-node-governance')).toHaveAttribute('data-state', 'known');
  await expect(page.getByTestId('tech-node-coil-weapons')).toHaveAttribute('data-state', 'locked');
  await page.getByTestId('tree-fit').click();
  await page.screenshot({ path: path.join(shotDir, 'tech-tree.png') });
  await page.screenshot({ path: '/opt/cursor/artifacts/tech-tree-after.png' });

  await page.getByTestId('tech-node-coil-weapons').click();
  await expect(page.getByTestId('tech-path')).toContainText('Basic Weapons');
  await expect(page.getByTestId('tech-path')).toContainText('Coil Weapons');
  await expect(page.getByTestId('tech-node-weapons')).toHaveClass(/is-chain/);
  await expect(page.getByTestId('tech-node-plasma-lance')).toHaveClass(/is-chain/);
  await expect(page.getByTestId('tech-detail')).toContainText('Plasma Lance');
  await page.screenshot({ path: '/opt/cursor/artifacts/tech-tree-chain.png' });

  await page.getByTestId('tech-tree-close').click();
  await expect(tree).toHaveCount(0);
  await page.keyboard.press('t');
  await expect(page.getByTestId('tech-tree')).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByTestId('tech-tree')).toHaveCount(0);

  await page.getByTestId('research-chip').click();
  await expect(page.getByTestId('tech-tree')).toBeVisible();
  await expect(page.locator('[data-testid="unit-list"] [data-role="scout"]')).toBeVisible();
});
