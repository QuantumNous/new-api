import { gotoPage, test } from '@e2e/helper';

test('should forward Vue runtime error logs to terminal', async ({ devOnly, page }) => {
  const rsbuild = await devOnly();

  // On Windows, Vue SFC compiler generates source maps with duplicate sources.
  // This happens because during `mergeSourceMaps`, magic-string returns normalized paths (/),
  // while the template source map retains the original paths (\).
  // See: https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/compileScript.ts#L1373
  //
  // Rspack deduplicates sources in source maps by appending `?[hash]` to duplicate paths.
  // Therefore, we use regex to match paths with an optional hash suffix.

  await gotoPage(page, rsbuild, '/undefinedError');
  await rsbuild.expectLog(
    /error {3}\[browser\] Uncaught TypeError: Cannot read properties of undefined \(reading 'name'\) at Proxy\.render \(src[\\/]UndefinedError\.vue(\?[a-f0-9]+)?:2:0\)/,
  );

  await gotoPage(page, rsbuild, '/eventError');
  await page.click('button');
  await rsbuild.expectLog(
    /error {3}\[browser\] Uncaught TypeError: Cannot read properties of null \(reading 'someMethod'\) at handleClick \(src[\\/]EventError\.vue(\?[a-f0-9]+)?:8:0\)/,
  );
});
