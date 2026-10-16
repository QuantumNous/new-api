import { expect, test } from '@e2e/helper';
import { findFile } from '@rstackjs/test-utils';

test('should allow to custom HTML filename', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();
  const fooFile = findFile(files, 'custom-foo.html');
  const barFile = findFile(files, 'custom-bar.html');

  expect(fooFile.endsWith('custom-foo.html')).toBeTruthy();
  expect(barFile.endsWith('custom-bar.html')).toBeTruthy();
});
