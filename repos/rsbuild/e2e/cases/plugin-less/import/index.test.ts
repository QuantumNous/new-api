import { expect, getFileContent, test } from '@e2e/helper';

test('should compile less import correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  expect(getFileContent(files, '.css')).toEqual('body{background-color:red}');
});
