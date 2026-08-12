import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should apply assetPrefix to assets in manifest entries', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const manifestContent = getFileContent(files, 'manifest.json');
  const manifest = JSON.parse(manifestContent);

  expect(manifest.entries.index.assets).toEqual([
    'https://cdn.example.com/assets/static/image/icon.png',
    'https://cdn.example.com/assets/static/js/index.js.map',
  ]);
  expect(manifest.entries.index).toMatchObject({
    initial: {
      js: ['https://cdn.example.com/assets/static/js/index.js'],
    },
    html: ['https://cdn.example.com/assets/index.html'],
  });
});
