import { expect, gotoPage, test } from '@e2e/helper';

const BUILD_FOO = 'building src/foo.js';

test('should lazy compile dynamic imported modules', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  // initial build
  await rsbuild.expectBuildEnd();
  rsbuild.expectNoLog(BUILD_FOO, { posix: true });
  rsbuild.clearLogs();

  // build foo.js
  await gotoPage(page, rsbuild, 'index');
  await rsbuild.expectLog(BUILD_FOO, { posix: true });
  await rsbuild.expectBuildEnd();
  const value = await page.evaluate(() => window.foo);
  expect(value).toBe(42);
});
