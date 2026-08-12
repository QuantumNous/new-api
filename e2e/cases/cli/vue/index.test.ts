import path from 'node:path';
import { expect, readDirContents, test } from '@e2e/helper';

test('should build Vue SFC correctly', async ({ execCliSync }) => {
  execCliSync('build');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('index.html'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('static/js/index.'))).toBeTruthy();
});
