import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { getFileContent, readDirContents } from '@rstackjs/test-utils';

test('should normalize browserslist required by jiti config', async ({ execCliSync }) => {
  // Regression for CJS arrays loaded by require() in a jiti config.
  // https://github.com/web-infra-dev/rsbuild/issues/8063
  execCliSync('build --config-loader jiti');

  const files = await readDirContents(path.join(import.meta.dirname, 'dist'));
  const content = getFileContent(files, '.css');

  expect(content).toContain('-webkit-transform:translateZ(0)');
  expect(content).toContain('top:0');
  expect(content).toContain('right:0');
  expect(content).toContain('bottom:0');
  expect(content).toContain('left:0');
  expect(content).not.toContain('inset:0');
});
