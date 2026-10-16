import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { findFile, getFileContent } from '@rstackjs/test-utils';

test('should inline style when `injectStyles` is enabled', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();

  // injectStyles worked
  const files = rsbuild.getDistFiles();
  expect(() => findFile(files, '.css')).toThrowError();

  // should inline minified CSS
  const indexJs = getFileContent(files, 'index.js');

  expect(indexJs.includes('html,body{margin:0;padding:0}')).toBeTruthy();
  expect(
    indexJs.includes('.description{text-align:center;font-size:16px;line-height:1.5}'),
  ).toBeTruthy();

  // scss worked
  const header = page.locator('#header');
  await expect(header).toHaveCSS('font-size', '20px');

  // less worked
  const title = page.locator('#title');
  await expect(title).toHaveCSS('font-size', '20px');
});

test('HMR should work well when `injectStyles` is enabled', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  // scss worked
  const header = page.locator('#header');
  await expect(header).toHaveCSS('font-size', '20px');

  // less worked
  const title = page.locator('#title');
  await expect(title).toHaveCSS('font-size', '20px');

  const locatorKeep = page.locator('#test-keep');
  const keepNum = await locatorKeep.innerHTML();

  await editFile(join(tempSrc, 'App.module.less'), (code) => code.replace('20px', '40px'));

  // CSS HMR works well
  await expect(title).toHaveCSS('font-size', '40px');

  // #test-keep should unchanged when CSS HMR
  expect(await locatorKeep.innerHTML()).toBe(keepNum);
});

test('should allow to disable CSS minification when `injectStyles` is enabled', async ({
  build,
}) => {
  const rsbuild = await build({
    config: {
      output: {
        minify: false,
      },
    },
  });

  // injectStyles worked
  const files = rsbuild.getDistFiles();
  expect(() => findFile(files, '.css')).toThrowError();

  // should inline CSS
  const indexJs = getFileContent(files, 'index.js');

  expect(
    indexJs.includes(`html, body {
  margin: 0;
  padding: 0;
}`),
  ).toBeTruthy();
});
