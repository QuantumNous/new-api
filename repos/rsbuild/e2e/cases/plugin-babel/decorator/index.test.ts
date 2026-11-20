import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';

test('should support legacy decorators and source.decorators.version in TypeScript', async ({
  page,
  buildPreview,
}) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel()],
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.FooService')).toBeTruthy();
});

test('should support legacy decorators and source.decorators.version in JavaScript', async ({
  page,
  buildPreview,
}) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel()],
      source: {
        entry: {
          index: './src/jsIndex.js',
        },
      },
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.FooService')).toBeTruthy();
});
