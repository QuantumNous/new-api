import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should use custom config when using --config option', async ({ execCliSync }) => {
  execCliSync('build --config ./custom.config.js');

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist-custom'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.length > 1).toBeTruthy();
});

test('should support custom config to find absolute path', async ({ execCliSync }) => {
  const absPath = path.join(import.meta.dirname, 'custom.config.js');
  execCliSync(`build --config ${absPath}`);
  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist-custom'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.length > 1).toBeTruthy();
});

test('should throw error when custom config not found', async ({ execCliSync }) => {
  expect(() => {
    execCliSync('build --config ./custom-not-found.config.js', {
      // only capture stderr output
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  }).toThrowError(/Cannot find config file: .*custom-not-found.config.js/);
});
