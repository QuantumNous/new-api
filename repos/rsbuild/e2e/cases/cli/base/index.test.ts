import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should run allow to specify base path', async ({ execCliSync }) => {
  execCliSync('build --base /test');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => outputs[item].includes('/test/static/js/index.'))).toBeTruthy();
});
