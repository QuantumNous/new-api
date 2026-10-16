import { expect, test } from '@e2e/helper';

test('support SSR load esm with type module', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  const url1 = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url1.href);
  const body = page.locator('body');

  await expect(body).toContainText('Rsbuild with React');
});
