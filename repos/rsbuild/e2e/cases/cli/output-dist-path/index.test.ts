import fs from 'node:fs';
import path from 'node:path';
import { expect, expectFile, readDirContents, test } from '@e2e/helper';

test('should set output dist path from CLI', async ({ execCliSync }) => {
  execCliSync('build --dist-path dist-custom');

  const distCustom = path.join(import.meta.dirname, 'dist-custom');
  await expectFile(path.join(distCustom, 'index.html'));

  const outputs = await readDirContents(distCustom);
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('static/js/index.'))).toBeTruthy();
  expect(fs.existsSync(path.join(import.meta.dirname, 'dist'))).toBeFalsy();
});
