import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should generate manifest file in output', async ({ build }) => {
  const rsbuild = await build({
    config: {
      output: {
        manifest: true,
        filenameHash: false,
      },
      splitChunks: false,
    },
  });

  const files = rsbuild.getDistFiles();

  const manifestContent = getFileContent(files, 'manifest.json');

  expect(manifestContent).toBeDefined();

  const manifest = JSON.parse(manifestContent);

  // index.js, index.html
  expect(Object.keys(manifest.allFiles).length).toBe(2);

  expect(manifest.entries.index).toMatchObject({
    initial: {
      js: ['/static/js/index.js'],
    },
    html: ['/index.html'],
  });
});

test('should always write manifest to disk when in dev', async ({ dev }) => {
  const rsbuild = await dev({
    config: {
      output: {
        distPath: 'dist-dev',
        manifest: true,
        filenameHash: false,
      },
      splitChunks: false,
    },
  });

  const files = rsbuild.getDistFiles();

  const manifestContent = getFileContent(files, 'manifest.json');

  expect(manifestContent).toBeDefined();
});
