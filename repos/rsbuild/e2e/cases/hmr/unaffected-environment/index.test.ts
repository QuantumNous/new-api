import { join } from 'node:path';
import { expect, gotoPage, test } from '@e2e/helper';

test('should not affect other unchanged environments during HMR', async ({
  page: page1,
  devOnly,
  editFile,
  copySrcDir,
  context,
}) => {
  const tempSrc = await copySrcDir();

  const rsbuild = await devOnly({
    config: {
      environments: {
        foo: {
          source: {
            entry: {
              foo: join(tempSrc, 'foo.js'),
            },
          },
        },
        bar: {
          source: {
            entry: {
              bar: join(tempSrc, 'bar.js'),
            },
          },
        },
      },
    },
  });

  const page2 = await context.newPage();
  await gotoPage(page1, rsbuild, 'foo');
  await gotoPage(page2, rsbuild, 'bar');

  // initial state
  await expect(page1.locator('body')).toHaveText('hello world');
  const button = page2.locator('#button');
  await expect(button).toHaveText('count: 0');
  await button.click();
  await expect(button).toHaveText('count: 1');

  // edit foo.js
  await editFile(join(tempSrc, 'foo.js'), (code) => code.replace('hello world', 'changed'));
  await expect(page1.locator('body')).toHaveText('changed');
  await expect(page2.locator('#button')).toHaveText('count: 1');
});
