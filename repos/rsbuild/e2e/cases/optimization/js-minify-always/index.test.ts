import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to minify JS in dev', async ({ dev }) => {
  const rsbuild = await dev();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('(){console.log("main")}');
});
