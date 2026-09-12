import { URL } from 'node:url';
import { expect, test } from '@e2e/helper';

test('should listen on an IPv6 host', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  await page.goto(new URL(`http://[::1]:${rsbuild.port}`).href);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');
});
