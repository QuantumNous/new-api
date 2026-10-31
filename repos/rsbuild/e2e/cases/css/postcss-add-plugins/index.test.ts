import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should call `addPlugins` helper with `order` options', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexCss = getFileContent(files, 'index.css');
  expect(indexCss).toEqual('body{color:green}');
});
