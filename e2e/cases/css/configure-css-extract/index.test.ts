import { expect, getFileContent, test } from '@e2e/helper';

test('should allow to configure options of CSSExtractPlugin', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'my-css.css');
  expect(content).toEqual('body{color:red}');
});
