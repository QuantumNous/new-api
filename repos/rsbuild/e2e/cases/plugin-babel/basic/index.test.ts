import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { myBabelPlugin } from './plugins/myBabelPlugin.ts';

test('should run babel with babel plugin correctly', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [
        pluginBabel({
          babelLoaderOptions: (_, { addPlugins }) => {
            addPlugins([myBabelPlugin]);
          },
        }),
      ],
    },
  });

  expect(await page.evaluate('window.b')).toBe(10);
});

test('should allow to exclude file from babel transformation', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      source: {
        exclude: [/aa/],
      },
      plugins: [
        pluginBabel({
          babelLoaderOptions: (_, { addPlugins }) => {
            addPlugins([myBabelPlugin]);
          },
        }),
      ],
    },
  });

  expect(await page.evaluate('window.b')).toBe(10);
  expect(await page.evaluate('window.bb')).toBeUndefined();
});
