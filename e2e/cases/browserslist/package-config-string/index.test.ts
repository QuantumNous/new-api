import { expect, getFileContent, test } from '@e2e/helper';

test('should read browserslist string from package.json', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexFile = getFileContent(files, 'index.js');
  expect(indexFile.includes('async ')).toBeFalsy();
});
