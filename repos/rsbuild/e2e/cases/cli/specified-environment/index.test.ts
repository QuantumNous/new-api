import { join } from 'node:path';
import { expect, readDirContents, test } from '@e2e/helper';
import fse from 'fs-extra';

const distPath = join(import.meta.dirname, 'dist');

test.beforeEach(async () => {
  await fse.remove(distPath);
});

test('should only build specified environment when using --environment option', async ({
  execCliSync,
}) => {
  execCliSync('build --environment web2');

  const files = await readDirContents(distPath);
  const outputFiles = Object.keys(files);

  expect(outputFiles.find((item) => item.includes('web1/index.html'))).toBeFalsy();
  expect(outputFiles.find((item) => item.includes('web2/index.html'))).toBeTruthy();
});

test('should build specified environments when using --environment shorten option', async ({
  execCliSync,
}) => {
  execCliSync('build --environment web1,web2');

  const files = await readDirContents(distPath);
  const outputFiles = Object.keys(files);

  expect(outputFiles.find((item) => item.includes('web1/index.html'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('web2/index.html'))).toBeTruthy();
});
