import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should run inspect command correctly', async ({ prepareDist, execCliSync }) => {
  const distPath = await prepareDist();
  execCliSync('inspect');

  const files = await readDirContents(path.join(distPath, '.rsbuild'));
  const fileNames = Object.keys(files);

  const config = fileNames.find((item) => item.includes('rsbuild.config.mjs'));
  expect(config).toBeTruthy();
  expect(files[config!]).toContain("'rsbuild:basic'");
  expect(files[config!]).toContain('hmr: true');
  expect(files[config!]).toContain('plugins:');

  const rspackConfig = fileNames.find((item) => item.includes('rspack.config.web.mjs'));
  expect(rspackConfig).toBeTruthy();
  expect(files[rspackConfig!]).toContain("mode: 'development'");
});

test('should run inspect command with mode option correctly', async ({
  prepareDist,
  execCliSync,
}) => {
  const distPath = await prepareDist();
  execCliSync('inspect --mode production');

  const files = await readDirContents(path.join(distPath, '.rsbuild'));
  const fileNames = Object.keys(files);

  const config = fileNames.find((item) => item.includes('rsbuild.config.mjs'));
  expect(config).toBeTruthy();

  const rspackConfig = fileNames.find((item) => item.includes('rspack.config.web.mjs'));
  expect(rspackConfig).toBeTruthy();
  expect(files[rspackConfig!]).toContain("mode: 'production'");
});

test('should run inspect command with output option correctly', async ({
  prepareDist,
  execCliSync,
}) => {
  const distPath = await prepareDist();
  execCliSync('inspect --output foo');

  const outputs = await readDirContents(path.join(distPath, 'foo'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.find((item) => item.includes('rsbuild.config.mjs'))).toBeTruthy();
  expect(outputFiles.find((item) => item.includes('rspack.config.web.mjs'))).toBeTruthy();
});
