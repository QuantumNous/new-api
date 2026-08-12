import { basename } from 'node:path';
import { expect, findFile, test } from '@e2e/helper';

test('should generate a vendor chunk when preset is "single-vendor" and target is "node"', async ({
  build,
}) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const vendorFile = findFile(
    files,
    (name) => name.includes('vendor') && files[name].includes('React'),
  );
  expect(vendorFile).toBeTruthy();

  const jsFiles = Object.keys(files)
    .filter((name) => name.endsWith('.js'))
    .map((name) => basename(name));

  expect(jsFiles.length).toEqual(2);
  expect(jsFiles).toContain('index.js');
  expect(jsFiles).toContain('vendor.js');
});
