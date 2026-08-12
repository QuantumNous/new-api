import { expect, gotoPage, test } from '@e2e/helper';

test('should skip lazy compilation when hmr and liveReload are disabled', async ({
  page,
  devOnly,
}) => {
  const lazyTriggerRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/_rspack/lazy/trigger')) {
      lazyTriggerRequests.push(request.url());
    }
  });

  const rsbuild = await devOnly();

  await rsbuild.expectBuildEnd();
  await gotoPage(page, rsbuild);

  const value = await page.evaluate(() => window.foo);
  expect(value).toBe(42);
  expect(lazyTriggerRequests).toHaveLength(0);
});
