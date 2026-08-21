import { basename } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should apply default preset as expected', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const jsFiles = Object.keys(files)
    .filter((name) => name.endsWith('.js'))
    .map((name) => basename(name));
  expect(jsFiles.sort()).toEqual(['index.js', 'lib-polyfill.js', 'lib-react.js']);
});
