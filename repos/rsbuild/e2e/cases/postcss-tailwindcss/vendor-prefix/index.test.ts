import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should generate tailwindcss utilities with vendor prefixes correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const indexCss = getFileContent(files, 'index.css');

  expect(indexCss).toContain('-webkit-user-select: none;');
  expect(indexCss).toContain('-ms-user-select: none;');
  expect(indexCss).toContain('user-select: none;');
});
