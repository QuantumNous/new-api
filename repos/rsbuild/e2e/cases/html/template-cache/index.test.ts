import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';

// https://github.com/web-infra-dev/rsbuild/issues/5176
test('should not re-compile templates when the template is not changed', async ({
  dev,
  page,
  editFile,
  copySrcDir,
}) => {
  let count = 0;

  const tempSrc = await copySrcDir();

  await dev({
    config: {
      root: tempSrc,
      source: {
        entry: {
          index: './index.js',
          bar: './bar.js',
        },
      },
      html: {
        template: ({ entryName }) => `./${entryName}.html`,
      },
      plugins: [
        {
          name: 'test-plugin',
          setup(api) {
            api.transform({ test: /\.html$/ }, ({ code }) => {
              count++;
              return `export default \`${code}\`;`;
            });
          },
        } satisfies RsbuildPlugin,
      ],
    },
  });

  await expect(page.locator('#root')).toHaveText('foo');
  expect(count).toEqual(2);

  // Re-compile the template when the template is changed
  await editFile(join(tempSrc, 'index.html'), (code) => code.replace('foo', 'foo2'));
  await expect(page.locator('#root')).toHaveText('foo2');
  // The count will be 4 as the childCompiler in html-rspack-plugin
  // will compile all the templates
  expect(count).toEqual(4);

  await editFile(join(tempSrc, 'index.js'), (code) => code.replace('foo', 'foo3'));
  await expect(page.locator('#content')).toHaveText('foo3');
  // The count should not change if the templates are not changed
  expect(count).toEqual(4);
});
