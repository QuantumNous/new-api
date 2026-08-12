import { expect, getFileContent, test } from '@e2e/helper';

test('should extend browserslist and downgrade syntax', async ({ build }) => {
  const originalCwd = process.cwd();
  process.chdir(import.meta.dirname);

  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexFile = getFileContent(files, 'index.js');

  expect(indexFile.includes('async ')).toBeFalsy();

  process.chdir(originalCwd);
});
