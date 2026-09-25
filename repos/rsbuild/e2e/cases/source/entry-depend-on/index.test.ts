import { expect, gotoPage, test } from '@e2e/helper';

test('should support an entry description object with dependOn', async ({ page, build }) => {
  const rsbuild = await build({
    runServer: true,
  });

  await gotoPage(page, rsbuild, 'foo');
  expect(await page.evaluate('window.test')).toBe('foo');

  await gotoPage(page, rsbuild, 'bar');
  expect(await page.evaluate('window.test')).toBe('foo-bar');

  await gotoPage(page, rsbuild, 'baz');
  expect(await page.evaluate('window.test')).toBe('foo-bar-baz');
});
