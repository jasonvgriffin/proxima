import { expect, test } from '@playwright/test';

test('contact sheet shows every unit in every faction color and the ark states', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__proximaDebug!.showUnits());
  const sheet = page.getByTestId('unit-sheet');
  await expect(sheet).toBeVisible();
  for (const kind of ['colony', 'terraformer', 'walker', 'infantry', 'rover', 'naval', 'transport']) {
    await expect(sheet.locator(`.unit-grid canvas[data-kind="${kind}"]`)).toHaveCount(6);
  }
  await expect(sheet.locator('canvas[data-ark="intact"]')).toHaveCount(3);
  await expect(sheet.locator('canvas[data-ark="impact"]')).toHaveCount(3);
  await expect(sheet.locator('canvas[data-ark="breakup"]')).toHaveCount(3);
  await expect(sheet.locator('canvas[data-selected="1"]')).toHaveCount(1);
  await expect(sheet.locator('canvas[data-stack="3"]')).toHaveCount(1);
});
