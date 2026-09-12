import { expect, gotoPage, test } from '@e2e/helper';

test('should support a custom dev server', async ({ page }) => {
  const { startDevServer } = await import('./scripts/server.js' as string);
  const { config, close } = await startDevServer(import.meta.dirname);

  await gotoPage(page, config);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  const url1 = new URL(`http://localhost:${config.port}/bbb`);

  await page.goto(url1.href);
  await expect(page.locator('body')).toContainText('Hello hono!');

  await close();
});

test('should support a custom dev server without compilation', async ({ page }) => {
  const { startDevServerPure } = await import('./scripts/pureServer.js' as string);
  const { config, close } = await startDevServerPure(import.meta.dirname);
  const indexRes = await gotoPage(page, config);

  expect(indexRes?.status()).toBe(404);

  const url1 = new URL(`http://localhost:${config.port}/bbb`);

  await page.goto(url1.href);
  await expect(page.locator('body')).toContainText('Hello hono!');

  const url2 = new URL(`http://localhost:${config.port}/test`);

  const res2 = await page.goto(url2.href);

  expect(await res2?.text()).toBe('Hello hono!');

  await close();
});
