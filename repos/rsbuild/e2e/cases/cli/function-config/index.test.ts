import path from 'node:path';
import { expect, getFileContent, readDirContents, test } from '@e2e/helper';
import fse from 'fs-extra';

const distDir = path.join(import.meta.dirname, 'dist');

test('should support exporting a function from the config file', async ({ execCliSync }) => {
  await fse.remove(distDir);
  execCliSync('build');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-production-build')).toBeTruthy();
});

test('should specify env as expected', async ({ execCliSync }) => {
  await fse.remove(distDir);
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

test('should specify env mode as expected', async ({ execCliSync }) => {
  await fse.remove(distDir);
  execCliSync('build --env-mode staging');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-staging-build')).toBeTruthy();
});

test('should parse build command after global option values', async ({ execCliSync }) => {
  await fse.remove(distDir);
  execCliSync('--env-mode inspect build');
  const files = await readDirContents(distDir);
  const content = getFileContent(files, 'index.js');
  expect(content.includes('production-inspect-build')).toBeTruthy();
});
