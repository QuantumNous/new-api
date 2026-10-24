import { gotoPage, test } from '@e2e/helper';

test('should forward React runtime error logs to terminal', async ({ devOnly, page }) => {
  const rsbuild = await devOnly();

  await gotoPage(page, rsbuild, '/undefinedError');
  await rsbuild.expectLog(
    `error   [browser] Uncaught TypeError: Cannot read properties of undefined (reading 'name') at ComponentWithUndefinedError (src/undefinedError.jsx:5:0)`,
    { posix: true },
  );

  await gotoPage(page, rsbuild, '/effectError');
  await rsbuild.expectLog(
    `error   [browser] Uncaught SyntaxError: Unexpected token 'i', "invalid json" is not valid JSON (src/effectError.jsx:6:0)`,
    { posix: true },
  );

  await gotoPage(page, rsbuild, '/eventError');
  await page.click('button');
  await rsbuild.expectLog(
    `error   [browser] Uncaught TypeError: Cannot read properties of null (reading 'someMethod') at handleClick (src/eventError.jsx:6:0)`,
    { posix: true },
  );
});
