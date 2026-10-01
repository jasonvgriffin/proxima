import { expect, test, type Page } from '@playwright/test';
import { INTRO_CHOICE_LAYOUT, INTRO_SCENES } from '../src/render/intro';

const FACTION_MARKS = [
  { name: 'The Helm', rgb: [228, 210, 168] },
  { name: 'Verdantia', rgb: [143, 209, 138] },
  { name: 'Genesis', rgb: [230, 197, 106] },
  { name: 'Ironclad', rgb: [225, 90, 76] },
  { name: 'Mnemosyne', rgb: [142, 182, 255] },
  { name: 'Clio', rgb: [226, 168, 204] },
];

const VIEWPORTS = [
  { width: 1024, height: 640, deviceScaleFactor: 1, label: '1024x640' },
  { width: 1280, height: 560, deviceScaleFactor: 1, label: '1280x560' },
  { width: 1536, height: 790, deviceScaleFactor: 1, label: '1536x790' },
  { width: 1920, height: 1000, deviceScaleFactor: 1, label: '1920x1000' },
  { width: 800, height: 500, deviceScaleFactor: 1, label: '800x500 partial' },
  { width: 1280, height: 720, deviceScaleFactor: 1.25, label: '1280x720 at 125% scale' },
  { width: 1280, height: 720, deviceScaleFactor: 1.5, label: '1280x720 at 150% scale' },
];

async function openIntro(page: Page) {
  await page.goto('/');
  await page.getByTestId('play-intro').click();
  await expect(page.getByTestId('intro-screen')).toBeVisible();
}

async function assertIntroChrome(page: Page) {
  await expect(page.getByTestId('intro-text')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('intro-next')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('intro-back')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('intro-skip')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('intro-exit')).toBeInViewport({ ratio: 1 });
  const box = await page.getByTestId('intro-text').boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 0.5);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 0.5);
}

async function assertScrollCannotHideText(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 2000);
    document.querySelector('.intro')?.scrollTo(0, 2000);
    document.querySelector('.intro-bar')?.scrollTo(0, 2000);
    document.querySelector('.intro-copy')?.scrollTo(0, 2000);
  });
  await page.mouse.wheel(0, 900);
  const position = await page.evaluate(() => ({
    y: window.scrollY,
    x: window.scrollX,
    pageOverflow: getComputedStyle(document.documentElement).overflowY,
  }));
  expect(position.y).toBe(0);
  expect(position.x).toBe(0);
  expect(position.pageOverflow).toBe('hidden');
  await assertIntroChrome(page);
}

async function visibleCanvasMarks(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  return page.evaluate(({ marks, layout }) => {
    const canvas = document.querySelector('#intro-canvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width < 2) return [];
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hits = (x0: number, y0: number, x1: number, y1: number, rgb: number[]) => {
      const left = Math.max(0, Math.floor(x0 * dpr));
      const top = Math.max(0, Math.floor(y0 * dpr));
      const right = Math.min(canvas.width, Math.ceil(x1 * dpr));
      const bottom = Math.min(canvas.height, Math.ceil(y1 * dpr));
      let count = 0;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * canvas.width + x) * 4;
          const dr = pixels[i] - rgb[0];
          const dg = pixels[i + 1] - rgb[1];
          const db = pixels[i + 2] - rgb[2];
          if (dr * dr + dg * dg + db * db <= 32 * 32) count += 1;
        }
      }
      return count;
    };
    const found: string[] = [];
    marks.forEach((mark, index) => {
      const cx = rect.width * (layout.x0 + index * layout.xStep);
      const cy = rect.height * layout.y;
      const crest = hits(cx - 40, cy - 40, cx + 40, cy + 40, mark.rgb);
      const name = hits(cx - 78, cy + 24, cx + 78, cy + 66, mark.rgb);
      const anchorX = rect.left + cx;
      const crestTop = rect.top + cy - 28;
      const nameBase = rect.top + cy + layout.nameDy;
      const onScreen =
        anchorX - 36 >= 0 &&
        anchorX + 36 <= window.innerWidth &&
        crestTop >= 0 &&
        nameBase <= window.innerHeight &&
        nameBase <= rect.bottom;
      if (crest >= 12 && name >= 8 && onScreen) found.push(mark.name);
    });
    return found;
  }, { marks: FACTION_MARKS, layout: INTRO_CHOICE_LAYOUT });
}

for (const vp of VIEWPORTS) {
  test(`introduction text stays on screen at ${vp.label}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    });
    const page = await context.newPage();
    await openIntro(page);
    for (let step = 0; step < INTRO_SCENES.length; step++) {
      await expect(page.getByTestId('intro-text')).toContainText(INTRO_SCENES[step].text.slice(0, 48));
      await assertIntroChrome(page);
      await assertScrollCannotHideText(page);
      if (step < INTRO_SCENES.length - 1) await page.getByTestId('intro-next').click();
    }
    await expect(page.getByTestId('intro-next')).toHaveText('Finish');
    await expect(await visibleCanvasMarks(page)).toEqual(FACTION_MARKS.map((mark) => mark.name));
    await context.close();
  });
}

test('skip intro returns to the start menu', async ({ page }) => {
  await openIntro(page);
  await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();
});

test('menu background and map stay inside a short wide window', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 560 } });
  const page = await context.newPage();
  await page.goto('/');
  const menu = await page.locator('.menu-bg').boundingBox();
  expect(menu).toBeTruthy();
  expect(menu!.y).toBeGreaterThanOrEqual(0);
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(560.5);
  await page.getByTestId('new-game').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.log')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('end-turn')).toBeInViewport({ ratio: 1 });
  await context.close();
});
