import { expect, getFileContent, test } from '@e2e/helper';

test('should compile CSS Modules with named exports correctly', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');

  expect(content).toMatch(
    /\.classA-\w{6}{color:red}\.classB-\w{6}{color:#00f}\.classC-\w{6}{color:#ff0}/,
  );

  const root = page.locator('#root');
  const text = await root.innerHTML();
  expect(text).toMatch(/classA-\w{6} classB-\w{6} classC-\w{6}/);
});
