import { expect, getFileContent, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';

test('should allow plugin to modify HTML content', async ({ build }) => {
  const myPlugin: RsbuildPlugin = {
    name: 'my-plugin',
    setup(api) {
      api.modifyHTML((html, { compilation, filename }) => {
        return html.replace(
          '<body>',
          `<body>
            <div>${filename}</div>
            <div>assets: ${Object.keys(compilation.assets).length}</div>
            `,
        );
      });
    },
  };

  const rsbuild = await build({
    config: {
      plugins: [myPlugin],
    },
  });

  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html.includes('<div>index.html</div>')).toBeTruthy();
  expect(html.includes('<div>assets: 2</div>')).toBeTruthy();
});

test('should run modifyHTML hook after modifyHTMLTags hook', async ({ build }) => {
  const myPlugin: RsbuildPlugin = {
    name: 'my-plugin',
    setup(api) {
      api.modifyHTMLTags((tags) => {
        tags.bodyTags.push({
          tag: 'div',
          children: 'foo',
        });
        return tags;
      });
      api.modifyHTML((html) => {
        return html.replace('foo', 'bar');
      });
    },
  };

  const rsbuild = await build({
    config: {
      plugins: [myPlugin],
    },
  });

  const files = rsbuild.getDistFiles();
  const html = getFileContent(files, 'index.html');

  expect(html.includes('foo')).toBeFalsy();
  expect(html.includes('bar')).toBeTruthy();
});
