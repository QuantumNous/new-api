import { expect, test } from '@e2e/helper';
import { getFileContent, normalizeEol } from '@rstackjs/test-utils';
import { pluginRem } from '@rsbuild/plugin-rem';

test('should preserve the expected script injection order', async ({ build }) => {
  const rsbuild = await build({
    config: {
      plugins: [
        pluginRem({
          inlineRuntime: false,
        }),
      ],
      html: {
        inject: false,
        template: './static/index.html',
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'index.html');

  // rem => normal resource => template custom resource
  expect(html.indexOf('/js/convert-rem') < html.indexOf('/js/index')).toBeTruthy();
  expect(html.indexOf('/js/index') < html.indexOf('/assets/a.js')).toBeTruthy();

  expect(html.indexOf('/js/index')).toBe(html.lastIndexOf('/js/index'));
});

test('should set inject via function correctly', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          index: './src/index.js',
          foo: './src/foo.js',
        },
      },
      output: {
        filenameHash: false,
      },
      html: {
        inject({ value, entryName }) {
          return entryName === 'foo' ? 'body' : value;
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(normalizeEol(fooHtml)).toEqual(
    `<!DOCTYPE html><html><head><title>Rsbuild App</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script defer src="/static/js/foo.js"></script></body></html>`,
  );

  const indexHtml = getFileContent(files, 'index.html');
  expect(normalizeEol(indexHtml)).toEqual(
    `<!DOCTYPE html><html><head><title>Rsbuild App</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script defer src="/static/js/index.js"></script><link href="/static/css/index.css" rel="stylesheet"></head><body><div id="root"></div></body></html>`,
  );
});
