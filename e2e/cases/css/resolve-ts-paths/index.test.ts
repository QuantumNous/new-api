import { expect, getFileContent, test } from '@e2e/helper';

test('should resolve ts paths correctly in SCSS file', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const content = getFileContent(files, '.css');

  expect(content).toContain('background-image:url(/static/image/icon');
});
