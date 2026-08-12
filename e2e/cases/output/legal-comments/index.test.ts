import { expect, findFile, getFileContent, test } from '@e2e/helper';
import { pluginReact } from '@rsbuild/plugin-react';

test('legalComments linked (default)', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      plugins: [pluginReact()],
      splitChunks: false,
    },
  });

  await expect(page.innerHTML('#test')).resolves.toBe('Hello Rsbuild!');

  const files = rsbuild.getDistFiles();

  const LicenseContent = getFileContent(files, 'static/js/index.js.LICENSE.txt');

  expect(LicenseContent.includes('@preserve AAAA')).toBeTruthy();
  expect(LicenseContent.includes('@license BBB')).toBeTruthy();
  expect(LicenseContent.includes('Legal Comment CCC')).toBeTruthy();
  expect(LicenseContent.includes('Foo Bar')).toBeFalsy();

  const JsContent = getFileContent(files, 'index.js');

  expect(JsContent.includes('Foo Bar')).toBeFalsy();
});

test('should omit legal comments when legalComments is set to "none"', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      plugins: [pluginReact()],
      splitChunks: false,
      output: {
        legalComments: 'none',
      },
    },
  });

  await expect(page.innerHTML('#test')).resolves.toBe('Hello Rsbuild!');

  const files = rsbuild.getDistFiles();

  expect(() => findFile(files, 'static/js/index.js.LICENSE.txt')).toThrow();

  const JsContent = getFileContent(files, 'static/js/index.js');

  expect(JsContent.includes('@license BBB')).toBeFalsy();
});

test('should inline legal comments when legalComments is set to "inline"', async ({
  page,
  buildPreview,
}) => {
  const rsbuild = await buildPreview({
    config: {
      plugins: [pluginReact()],
      splitChunks: false,
      output: {
        legalComments: 'inline',
      },
    },
  });

  await expect(page.innerHTML('#test')).resolves.toBe('Hello Rsbuild!');

  const files = rsbuild.getDistFiles();

  expect(() => findFile(files, 'static/js/index.js.LICENSE.txt')).toThrow();

  const JsContent = getFileContent(files, 'static/js/index.js');

  expect(JsContent.includes('@license BBB')).toBeTruthy();
  expect(JsContent.includes('Foo Bar')).toBeFalsy();
});
