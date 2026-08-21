import { basename } from 'node:path';

import { expect, test } from '@e2e/helper';

test('should support `forceSplitting` when chunkSplit is "single-vendor"', async ({ build }) => {
  const rsbuild = await build();

  const files = rsbuild.getDistFiles();

  const jsFiles = Object.keys(files)
    .filter((name) => name.endsWith('.js'))
    .map((name) => basename(name));

  expect(jsFiles.length).toEqual(3);
  expect(jsFiles).toContain('index.js');
  expect(jsFiles).toContain('vendor.js');
  expect(jsFiles).toContain('my-react.js');
});
