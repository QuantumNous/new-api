import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow to disable the built-in lightningcss loader', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.css');

  expect(content).not.toContain('-webkit-');
  expect(content).not.toContain('-ms-');
});
