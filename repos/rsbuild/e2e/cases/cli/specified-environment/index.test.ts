import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should only build specified environment when using --environment option', async ({
  prepareDist,
  execCliSync,
}) => {
  const distPath = await prepareDist();
  execCliSync('build --environment web2');

  const files = await readDirContents(distPath);
  const outputFiles = Object.keys(files);

  expect(outputFiles.find((item) => item.includes('web1/index.html'))).toBeFalsy();
  expect(outputFiles.find((item) => item.includes('web2/index.html'))).toBeTruthy();
});

test('should build specified environments when using --environment shorten option', async ({
  prepareDist,
  execCliSync,
}) => {
  const distPath = await prepareDist();
  execCliSync('build --environment web1,web2');

  const files = await readDirContents(distPath);
  const outputFiles = Object.keys(files);

  expect(outputFiles.find((item) => item.includes('web1/index.html'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('web2/index.html'))).toBeTruthy();
});
