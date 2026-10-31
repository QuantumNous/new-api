import { promises } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

test('should return raw asset content with `?raw`', async ({ page, runBothServe }) => {
  await runBothServe(async () => {
    expect(await page.evaluate('window.rawSvg')).toEqual(
      await promises.readFile(join(import.meta.dirname, '../../../assets/circle.svg'), 'utf-8'),
    );
  });
});

test('should return raw SVG content with `?raw` when using pluginSvgr', async ({ page, dev }) => {
  await dev({
    config: {
      plugins: [pluginSvgr()],
    },
  });

  expect(await page.evaluate('window.rawSvg')).toEqual(
    await promises.readFile(join(import.meta.dirname, '../../../assets/circle.svg'), 'utf-8'),
  );
});

test('should return raw JS content with `?raw`', async ({ page, dev }) => {
  await dev();

  expect(await page.evaluate('window.rawJs')).toEqual(
    await promises.readFile(join(import.meta.dirname, 'src/foo.js'), 'utf-8'),
  );
});

test('should return raw TS content with `?raw`', async ({ page, dev }) => {
  await dev();

  const tsContent = await promises.readFile(join(import.meta.dirname, 'src/bar.ts'), 'utf-8');
  expect(await page.evaluate('window.rawTs1')).toEqual(tsContent);
  expect(await page.evaluate('window.rawTs2')).toEqual(tsContent);
  expect(await page.evaluate('window.rawTs3')).toEqual(tsContent);
  expect(await page.evaluate('window.rawTs4')).toEqual(tsContent);
});

test('should return raw TSX content with `?raw` when using pluginReact', async ({ page, dev }) => {
  await dev({
    config: {
      plugins: [pluginReact()],
    },
  });

  expect(await page.evaluate('window.rawTsx')).toEqual(
    await promises.readFile(join(import.meta.dirname, 'src/baz.tsx'), 'utf-8'),
  );
});

test('should not get raw SVG content with query other than `?raw`', async ({ page, dev }) => {
  await dev();

  expect((await page.evaluate<string>('window.normalSvg')).startsWith('data:image/svg+xml')).toBe(
    true,
  );
});

test('should not get raw JS content with query other than `?raw`', async ({ page, dev }) => {
  await dev();
  expect(await page.evaluate('window.normalJs')).toEqual('foo');
});
