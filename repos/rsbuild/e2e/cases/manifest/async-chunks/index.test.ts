import { expect, getFileContent, test } from '@e2e/helper';

test('should generate manifest for async chunks correctly', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const manifestContent = getFileContent(files, 'manifest.json');

  expect(manifestContent).toBeDefined();

  const manifest = JSON.parse(manifestContent);

  expect(Object.keys(manifest.allFiles).length).toBe(4);

  expect(manifest.entries.index).toMatchObject({
    html: ['/index.html'],
    initial: {
      js: ['/static/js/index.js'],
    },
    async: {
      js: ['/static/js/async/async-chunk.js'],
      css: ['/static/css/async/async-chunk.css'],
    },
  });
});
