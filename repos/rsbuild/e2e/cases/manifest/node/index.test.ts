import { expect, getFileContent, test } from '@e2e/helper';

test('should generate manifest file when target is node', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const manifestContent = getFileContent(files, 'manifest.json');

  expect(manifestContent).toBeDefined();

  const manifest = JSON.parse(manifestContent);
  expect(Object.keys(manifest.allFiles).length).toBe(1);

  expect(manifest.entries.index).toMatchObject({
    initial: {
      js: ['/index.js'],
    },
  });
});
