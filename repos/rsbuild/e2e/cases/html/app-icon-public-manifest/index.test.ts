import { expect, test } from '@e2e/helper';
import { getDistFiles, getFileContent } from '@rstackjs/test-utils';

test('should use public manifest for additional manifest fields', async ({ build }) => {
  const rsbuild = await build();
  const files = await getDistFiles(rsbuild.distPath);
  const html = getFileContent(files, 'index.html');
  const manifest = getFileContent(files, 'manifest.webmanifest');

  expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  expect(JSON.parse(manifest)).toEqual({
    name: 'My Website',
    short_name: 'Website',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  });
});
