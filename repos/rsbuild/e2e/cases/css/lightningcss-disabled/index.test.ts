import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to disable the built-in lightningcss loader', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.css');

  expect(content).not.toContain('-webkit-');
  expect(content).not.toContain('-ms-');
});
