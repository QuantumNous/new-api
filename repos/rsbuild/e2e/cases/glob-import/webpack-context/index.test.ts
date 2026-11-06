import { expect, test } from '@e2e/helper';

test('should glob import components correctly', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    await expect(page.locator('#header')).toHaveText('Header');
    await expect(page.locator('#footer')).toHaveText('Footer');
  });
});
