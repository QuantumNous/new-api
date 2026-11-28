import { join } from 'node:path';
import { expect, gotoPage, test } from '@e2e/helper';

test('should perform HMR for multiple environments with shared module', async ({
  page,
  devOnly,
  editFile,
  copySrcDir,
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

  const expectValue = async (value: string) => {
    const locator = page.locator('body');
    await expect(locator).toHaveText(value);
  };

  await gotoPage(page, rsbuild, 'foo');
  await expectValue('foo:hello');
  await gotoPage(page, rsbuild, 'bar');
  await expectValue('bar:hello');

  // edit shared module
  await editFile(join(tempSrc, 'shared.js'), (code) => code.replace('hello', 'world'));
  await gotoPage(page, rsbuild, 'foo');
  await expectValue('foo:world');
  await gotoPage(page, rsbuild, 'bar');
  await expectValue('bar:world');

  // edit foo entry module
  await editFile(join(tempSrc, 'foo.js'), (code) => code.replace('foo', 'foo2'));
  await gotoPage(page, rsbuild, 'foo');
  await expectValue('foo2:world');

  // edit bar entry module
  await editFile(join(tempSrc, 'bar.js'), (code) => code.replace('bar', 'bar2'));
  await gotoPage(page, rsbuild, 'bar');
  await expectValue('bar2:world');
});
