import { expect, getFileContent, test } from '@e2e/helper';

test('should allow plugin to transform code with Buffer return', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const indexJs = getFileContent(files, 'index.js');
  const indexCss = getFileContent(files, 'index.css');

  expect(indexJs.includes('world')).toBeTruthy();
  expect(indexCss.includes('#00f')).toBeTruthy();
});
