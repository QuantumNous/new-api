import { join } from 'node:path';
import { expect, gotoPage, test } from '@e2e/helper';

test('should allow to create multiple HMR connections', async ({
  page: page1,
  context,
  devOnly,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  const rsbuild = await devOnly({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  const page2 = await context.newPage();
  await gotoPage(page1, rsbuild);
  await gotoPage(page2, rsbuild);

  const locator1 = page1.locator('#test');
  const locator2 = page2.locator('#test');

  await expect(locator1).toHaveText('Hello Rsbuild!');
  await expect(locator2).toHaveText('Hello Rsbuild!');

  const locatorKeep1 = page1.locator('#test-keep');
  const locatorKeep2 = page2.locator('#test-keep');
  const keepNum1 = await locatorKeep1.innerHTML();
  const keepNum2 = await locatorKeep2.innerHTML();

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('Hello Rsbuild', 'Hello Test'));

  await expect(locator1).toHaveText('Hello Test!');
  await expect(locator2).toHaveText('Hello Test!');

  // #test-keep should remain unchanged when app.tsx HMR
  expect(await locatorKeep1.innerHTML()).toBe(keepNum1);
  expect(await locatorKeep2.innerHTML()).toBe(keepNum2);
});
