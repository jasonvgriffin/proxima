import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const shotDir = '/opt/cursor/artifacts';

test('download consent warns that the game will close and restart', async ({ page }) => {
  fs.mkdirSync(shotDir, { recursive: true });
  await page.goto('/');
  await expect(page.getByTestId('start-menu')).toBeVisible();
  await page.evaluate(() => window.__proximaDebug!.showDownloadConsent());
  const warning = page.getByTestId('download-warning');
  await expect(warning).toHaveText('Proxima will download version 0.4.1, save your game, then close and restart to finish the update.');
  await expect(page.getByTestId('download-name')).toContainText('Proxima-Setup-0.4.1.exe');
  await expect(page.getByTestId('download-confirm')).toBeVisible();
  await expect(page.getByTestId('download-cancel')).toBeVisible();
  await page.screenshot({ path: `${shotDir}/update-consent.png` });

  await page.getByTestId('download-cancel').click();
  await expect(page.getByTestId('download-consent')).toHaveCount(0);

  await page.evaluate(() => window.__proximaDebug!.showUpdateReady());
  await expect(page.getByTestId('update-ready-copy')).toHaveText('Ready to update — Proxima will save, close and restart into v0.4.1.');
  await expect(page.getByTestId('update-restart')).toBeVisible();
  await expect(page.getByTestId('update-later')).toBeVisible();
  await page.screenshot({ path: `${shotDir}/update-ready.png` });

  await page.getByTestId('update-later').click();
  await expect(page.getByTestId('update-ready')).toHaveCount(0);
});
