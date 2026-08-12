import { expect, getFileContent, test } from '@e2e/helper';

// see: https://github.com/rstackjs/html-rspack-plugin/issues/14
test('should compile template with es template correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const indexHtml = getFileContent(files, 'index.html');
  expect(indexHtml).toContain("const baseUrl = match ? `${match[0]}/` : '/'");
});
