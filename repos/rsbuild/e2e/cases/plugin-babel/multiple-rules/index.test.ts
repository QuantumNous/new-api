import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { firstBabelPlugin, secondBabelPlugin } from './babelPlugins.ts';

test('should apply different babel plugins to matched files', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [
        pluginBabel({
          include: /aa\.js$/,
          babelLoaderOptions: (_, { addPlugins }) => {
            addPlugins([firstBabelPlugin]);
          },
        }),
        pluginBabel({
          include: /ab\.js$/,
          babelLoaderOptions: (_, { addPlugins }) => {
            addPlugins([secondBabelPlugin]);
          },
        }),
      ],
    },
  });

  expect(await page.evaluate('window.main')).toBe(10);
  await expect.poll(() => page.evaluate('window.bb')).toBe(10);
  await expect.poll(() => page.evaluate('window.cc')).toBe(10);
  expect(await page.evaluate('window.aa')).toBeUndefined();
  expect(await page.evaluate('window.ab')).toBeUndefined();
});
