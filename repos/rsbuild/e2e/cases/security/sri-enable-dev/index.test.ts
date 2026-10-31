import { expect, test } from '@e2e/helper';

test('generate integrity for script and style tags in dev build', async ({ page, dev }) => {
  const rsbuild = await dev();

  const testEl = page.locator('#root');
  await expect(testEl).toHaveText('Hello Rsbuild!');

  expect(
    await page.evaluate('document.querySelector("script")?.getAttribute("integrity")'),
  ).toMatch(/sha384-[A-Za-z0-9+/=]+/);

  await rsbuild.expectLog('SubResourceIntegrityPlugin may interfere with hot reloading');
});
