import { expect, test } from '@e2e/helper';

test('should support worker query imports inside workers', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#worker')).toHaveText(/main http/);
    await expect(page.locator('#sub')).toHaveText('sub:sub');
    await expect(page.locator('#ctor')).toHaveText('ctor');
  });
});
