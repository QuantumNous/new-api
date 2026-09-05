import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile less npm import correctly', async ({ build, copyNodeModules }) => {
  await copyNodeModules();

  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const cssContent = getFileContent(files, '.css');

  expect(cssContent).toEqual('html{height:100%}body{color:red}');
});
