import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents, waitForFile } from '@rstackjs/test-utils';

test('should set output dist path from CLI', async ({ prepareDist, execCliSync }) => {
  const distPath = await prepareDist();
  const distCustom = await prepareDist('dist-custom');
  execCliSync('build --dist-path dist-custom');

  await waitForFile(path.join(distCustom, 'index.html'));

  const outputs = await readDirContents(distCustom);
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('static/js/index.'))).toBeTruthy();
  expect(fs.existsSync(distPath)).toBeFalsy();
});
