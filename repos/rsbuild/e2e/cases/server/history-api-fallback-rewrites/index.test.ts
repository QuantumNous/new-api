import { expect, test } from '@e2e/helper';

test('should apply `historyApiFallback.rewrites` correctly', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  await page.goto(`http://localhost:${rsbuild.port}`);
  expect(await page.locator('#root').innerHTML()).toEqual('index');

  // `/baz` should be rewritten to `/foo`
  await page.goto(`http://localhost:${rsbuild.port}/baz`);
  expect(await page.locator('#root').innerHTML()).toEqual('foo');

  await page.goto(`http://localhost:${rsbuild.port}/bar`);
  expect(await page.locator('#root').innerHTML()).toEqual('bar');
});
