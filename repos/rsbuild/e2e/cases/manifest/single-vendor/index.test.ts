import { expect, getFileContent, test } from '@e2e/helper';

test('should generate manifest with single vendor as expected', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const manifestContent = getFileContent(files, 'manifest.json');

  expect(manifestContent).toBeDefined();

  const manifest = JSON.parse(manifestContent);

  expect(Object.keys(manifest.allFiles).length).toBe(3);

  expect(manifest.entries.index).toMatchObject({
    html: ['/index.html'],
    initial: {
      js: expect.arrayContaining(['/static/js/vendor.js', '/static/js/index.js']),
    },
  });
});
