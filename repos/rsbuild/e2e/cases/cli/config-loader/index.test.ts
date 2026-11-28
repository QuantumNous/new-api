import path from 'node:path';
import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should use Node.js native loader to load config', async ({ execCliSync }) => {
  if (!process.features.typescript) {
    return;
  }

  execCliSync('build --config-loader native', {
    env: {
      NODE_OPTIONS: '--experimental-strip-types',
    },
  });

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist-custom'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.length > 1).toBeTruthy();
});

test('should fallback to jiti when config loader set to auto', async ({ execCliSync }) => {
  execCliSync('build --config-loader auto --config rsbuild.config.auto.mts', {
    env: {
      NODE_OPTIONS: '--experimental-strip-types',
    },
  });

  const outputs = await readDirContents(path.join(import.meta.dirname, 'dist-auto'));
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.length > 1).toBeTruthy();
});
