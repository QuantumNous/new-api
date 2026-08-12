import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow to configure options of CSSExtractPlugin', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'my-css.css');
  expect(content).toEqual('body{color:red}');
});
