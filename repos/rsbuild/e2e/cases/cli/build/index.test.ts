import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should run build command correctly', async ({ execCliSync }) => {
  execCliSync('build');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('index.html'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('static/js/index.'))).toBeTruthy();
});
