import { expect, test } from '@e2e/helper';

// https://github.com/web-infra-dev/rspack/issues/6470
test('should generate unique classname for different CSS Modules files', async ({
  page,
  runBothServe,
}) => {
  await runBothServe(async () => {
    const test1Locator = page.locator('#test1');
    await expect(test1Locator).toHaveCSS('color', 'rgb(255, 0, 0)');

    const test2Locator = page.locator('#test2');
    await expect(test2Locator).toHaveCSS('color', 'rgb(0, 0, 255)');
  });
});
