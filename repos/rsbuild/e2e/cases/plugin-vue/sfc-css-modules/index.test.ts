import { expect, test } from '@e2e/helper';

test('should build Vue SFC with CSS Modules correctly', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    const test1 = page.locator('#test1');
    const test2 = page.locator('#test2');
    const test3 = page.locator('#test3');

    await expect(test1).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(test2).toHaveCSS('color', 'rgb(0, 0, 255)');
    await expect(test3).toHaveCSS('color', 'rgb(0, 128, 0)');
  });
});
