import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to custom CSS minify options', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.css');

  expect(content).toEqual('.bar{color:green}');
});
