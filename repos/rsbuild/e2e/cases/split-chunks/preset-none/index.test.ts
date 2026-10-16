import { basename } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should not apply built-in preset rules when preset is "none"', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const jsFiles = Object.keys(files)
    .filter((name) => name.endsWith('.js'))
    .map((name) => basename(name));

  expect(jsFiles).toContain('index.js');
  expect(jsFiles.some((file) => file.includes('lib-react'))).toBeFalsy();
  expect(jsFiles.some((file) => file.includes('lib-polyfill'))).toBeFalsy();
});
