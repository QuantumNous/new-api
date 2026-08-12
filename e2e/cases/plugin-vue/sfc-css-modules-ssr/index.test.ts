import { expect, getFileContent, test } from '@e2e/helper';

test('should build Vue SFC with CSS Modules correctly in dev build for node target', async ({
  dev,
}) => {
  const rsbuild = await dev();

  const files = rsbuild.getDistFiles();
  const indexJs = getFileContent(files, 'index.js');
  expect(indexJs).toMatch(/`src-App__red-\w{6}`/);
  expect(indexJs).toMatch(/`src-App__blue-\w{6}`/);
});

test('should build Vue SFC with CSS Modules correctly in build for node target', async ({
  buildPreview,
}) => {
  const rsbuild = await buildPreview();

  const files = rsbuild.getDistFiles();
  const indexJs = getFileContent(files, 'index.js');
  expect(indexJs).toMatch(/`red-\w{6}`/);
  expect(indexJs).toMatch(/`blue-\w{6}`/);
});
