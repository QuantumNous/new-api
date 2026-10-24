import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should preserve viewBox after svgo minification', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.js');

  expect(content.includes('width:120,height:120,viewBox:"0 0 120 120"')).toBeTruthy();
});
