import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should allow plugin to transform code and call `importModule`', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexCss = getFileContent(files, 'index.css');

  expect(indexCss.includes('#00f')).toBeTruthy();
});
