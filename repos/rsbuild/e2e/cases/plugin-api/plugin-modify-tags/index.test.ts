import { expect, getFileContent, test } from '@e2e/helper';

test('should allow plugin to modify HTML tags', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(
    html.includes(
      '<script defer src="https://example.com/static/js/index.js"></script><link href="https://example.com/static/css/index.css" rel="stylesheet"><script id="foo" src="https://example.com/foo.js"></script></head>',
    ),
  ).toBeTruthy();
  expect(
    html.includes(
      '<script id="bar" src="https://cdn.com/bar.js"></script><div>index.html</div><div>assets: 2</div></body>',
    ),
  ).toBeTruthy();
});
