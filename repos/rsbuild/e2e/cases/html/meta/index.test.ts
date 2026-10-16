import { expect, test } from '@e2e/helper';
import { getFileContent, normalizeEol } from '@rstackjs/test-utils';

test('should not inject charset meta if template already contains it', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const html = getFileContent(files, 'index.html');
  expect(normalizeEol(html)).toEqual(`<!doctype html>
<html>
  <head>
    <title>Page Title</title>
    <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"><script defer src="/static/js/index.js"></script></head>
  <body>
    <div id="root"></div>
  </body>
</html>
`);
});

test('should generate meta tags via function for each entry', async ({ build }) => {
  const rsbuild = await build({
    config: {
      source: {
        entry: {
          foo: './src/index.js',
          bar: './src/index.js',
        },
      },
      html: {
        meta({ entryName }) {
          return {
            description: `${entryName} page`,
            'og:title': {
              property: 'og:title',
              content: entryName,
            },
          };
        },
      },
    },
  });
  const files = rsbuild.getDistFiles();

  const fooHtml = getFileContent(files, 'foo.html');
  expect(fooHtml).toContain('<meta name="description" content="foo page">');
  expect(fooHtml).toContain('<meta property="og:title" content="foo">');

  const barHtml = getFileContent(files, 'bar.html');
  expect(barHtml).toContain('<meta name="description" content="bar page">');
  expect(barHtml).toContain('<meta property="og:title" content="bar">');
});
