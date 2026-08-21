import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should read browserslist array from package.json', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexFile = getFileContent(files, 'index.js');
  expect(indexFile.includes('async ')).toBeFalsy();
});
