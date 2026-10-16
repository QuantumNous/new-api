import { expect, test } from '@e2e/helper';
import { getFileContent, readDirContents } from '@rstackjs/test-utils';

test('should support exporting a function from the config file', async ({
  prepareDist,
  execCliSync,
}) => {
  const distDir = await prepareDist();
  execCliSync('build');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-production-build')).toBeTruthy();
});

test('should specify env as expected', async ({ prepareDist, execCliSync }) => {
  const distDir = await prepareDist();
  execCliSync('build', {
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('development-development-build')).toBeTruthy();
});

test('should specify env mode as expected', async ({ prepareDist, execCliSync }) => {
  const distDir = await prepareDist();
  execCliSync('build --env-mode staging');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-staging-build')).toBeTruthy();
});

test('should parse build command after global option values', async ({
  prepareDist,
  execCliSync,
}) => {
  const distDir = await prepareDist();
  execCliSync('--env-mode inspect build');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-inspect-build')).toBeTruthy();
});
