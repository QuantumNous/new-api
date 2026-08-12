import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should run build command with --root option correctly', async ({ execCliSync }) => {
  execCliSync('build --root test');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'test', 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.endsWith('static/js/index.js'))).toBeTruthy();
});

test('should run build command with -r option correctly', async ({ execCliSync }) => {
  execCliSync('build -r test');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'test', 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.endsWith('static/js/index.js'))).toBeTruthy();
});
