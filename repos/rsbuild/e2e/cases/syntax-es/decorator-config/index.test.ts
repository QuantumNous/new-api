import { expect, test } from '@e2e/helper';
import { pluginBabel } from '@rsbuild/plugin-babel';

test('should use 2023-11 decorators by default', async ({ page, buildPreview }) => {
  await buildPreview();

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});

test('should allow to use 2022-03 decorators', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      source: {
        decorators: {
          version: '2022-03',
        },
      },
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});

test('should allow to use legacy decorators', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      source: {
        decorators: {
          version: 'legacy',
        },
      },
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});

test('should use 2023-11 decorators with babel-plugin by default', async ({
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
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});

test('should allow to use 2022-03 decorators with babel-plugin', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel()],
      source: {
        decorators: {
          version: '2022-03',
        },
      },
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});

test('should allow to use legacy decorators with babel-plugin', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [pluginBabel()],
      source: {
        decorators: {
          version: 'legacy',
        },
      },
    },
  });

  expect(await page.evaluate('window.aaa')).toBe('hello');
  expect(await page.evaluate('window.bbb')).toBe('world');
  expect(await page.evaluate('window.ccc')).toBe('hello world');
});
