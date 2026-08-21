import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile less inline js correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const cssContent = getFileContent(files, '.css');

  expect(cssContent).toEqual('body{opacity:.2}');
});
