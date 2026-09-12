import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow to minify JS in dev', async ({ dev }) => {
  const rsbuild = await dev();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, '.js');

  expect(content).toContain('(){console.log("main")}');
});
