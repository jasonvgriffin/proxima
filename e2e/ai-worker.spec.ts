import { expect, test } from '@playwright/test';

test('worker rival orders match the in-thread AI', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Game }, client] = await Promise.all([
      import('/src/core/game.ts'),
      import('/src/ai/client.ts'),
    ]);
    const options = { seed: 6, player: 'helm' as const, mapSize: 'small' as const, randomEvents: true };
    const direct = Game.newGame(options);
    const viaWorker = Game.newGame(options);
    direct.endTurn();
    await viaWorker.endTurnWith((state, order) => client.requestRoundOrders(state, order));
    const left = JSON.stringify(direct.serialize());
    const right = JSON.stringify(viaWorker.serialize());
    let mismatch = '';
    if (left !== right) {
      const limit = Math.min(left.length, right.length);
      let index = 0;
      while (index < limit && left[index] === right[index]) index += 1;
      mismatch = `at ${index}: ${left.slice(Math.max(0, index - 40), index + 40)}`;
    }
    return { path: client.lastRivalPath, match: left === right, mismatch };
  });
  expect(result.path).toBe('worker');
  expect(result.mismatch).toBe('');
  expect(result.match).toBe(true);
});
