import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';
import { pluginReact } from '@rsbuild/plugin-react';

test('should treat specified modules as externals', async ({ page, buildPreview }) => {
  await buildPreview({
    config: {
      plugins: [pluginReact()],
      output: {
        externals: {
          './aaa': 'aa',
        },
      },
      source: {
        preEntry: './src/ex.js',
      },
    },
  });

  const test = page.locator('#test');
  await expect(test).toHaveText('Hello Rsbuild!');

  const testExternal = page.locator('#test-external');
  await expect(testExternal).toHaveText('1');

  const externalVar = await page.evaluate('window.aa');

  expect(externalVar).toBeDefined();
});

test('should not externalize dependencies when target is web worker', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [pluginReact()],
      output: {
        target: 'web-worker',
        externals: {
          react: 'MyReact',
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.js');
  expect(content.includes('MyReact')).toBeFalsy();
});
