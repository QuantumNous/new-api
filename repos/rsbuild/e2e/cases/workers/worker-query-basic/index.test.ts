import { expect, test } from '@e2e/helper';

test('should support worker query imports', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#worker')).toHaveText('named: 42');
    await expect(page.locator('#mjs')).toHaveText('mjs: 42');
  });
});
