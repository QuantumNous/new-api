import { expect, getFileContent, test } from '@e2e/helper';

test('should compile nested npm import correctly', async ({ build, copyNodeModules }) => {
  await copyNodeModules();

  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const cssContent = getFileContent(files, '.css');

  expect(cssContent).toEqual('#b{color:#ff0}#c{color:green}#a{font-size:10px}html{font-size:18px}');
});
