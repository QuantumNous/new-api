import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should set NODE_ENV correctly when running build command', async ({ execCliSync }) => {
  delete process.env.NODE_ENV;
  execCliSync('build');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist-prod'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.length > 1).toBeTruthy();
});
