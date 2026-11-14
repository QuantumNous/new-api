import { expect, test } from '@e2e/helper';

test('should resolve package.json#imports correctly', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const foo = page.locator('#foo');
    await expect(foo).toHaveText('foo');
    const test = page.locator('#test');
    await expect(test).toHaveText('test');
  });
});
