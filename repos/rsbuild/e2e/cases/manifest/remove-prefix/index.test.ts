import { expect, getFileContent, test } from '@e2e/helper';

test('should remove prefix from manifest', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        assetPrefix: 'http://example.com/',
        manifest: {
          prefix: false,
        },
        filenameHash: false,
      },
      splitChunks: false,
    },
  });

  const files = rsbuild.getDistFiles();
  const manifestContent = getFileContent(files, 'manifest.json');
  const manifest = JSON.parse(manifestContent);

  expect(manifest.allFiles).toEqual(['static/css/index.css', 'static/js/index.js', 'index.html']);
  expect(manifest.entries.index).toMatchObject({
    initial: {
      js: ['static/js/index.js'],
      css: ['static/css/index.css'],
    },
    html: ['index.html'],
  });
});
