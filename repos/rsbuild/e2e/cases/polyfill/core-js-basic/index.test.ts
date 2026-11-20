import { expect, test } from '@e2e/helper';
import { getPolyfillContent } from '../helper';

const EXPECT_VALUE = {
  '1': [
    { type: '1', value: 1 },
    { type: '1', value: 2 },
  ],
  '2': [{ type: '2', value: 3 }],
};

test('should add polyfill when set polyfill entry (default)', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      output: {
        polyfill: 'entry',
        sourceMap: {
          js: 'source-map',
        },
      },
    },
  });

  expect(await page.evaluate('window.a')).toEqual(EXPECT_VALUE);

  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const content = getPolyfillContent(files);

  // should polyfill all api
  expect(content.includes('object.group-by.js')).toBeTruthy();
  expect(content.includes('object.has-own.js')).toBeTruthy();
});

test('should add polyfill when set polyfill usage', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      output: {
        polyfill: 'usage',
        sourceMap: {
          js: 'source-map',
        },
      },
    },
  });

  page.on('pageerror', (err) => {
    console.log('page err', err);
  });

  expect(await page.evaluate('window.a')).toEqual(EXPECT_VALUE);

  const files = rsbuild.getDistFiles({ sourceMaps: true });

  const content = getPolyfillContent(files);

  // should only polyfill some usage api
  expect(content.includes('object.group-by.js')).toBeTruthy();
  expect(content.includes('object.has-own.js')).toBeFalsy();
});
