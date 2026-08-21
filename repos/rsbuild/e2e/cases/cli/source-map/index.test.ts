import { expect, test } from '@e2e/helper';
import { readDirContents } from '@rstackjs/test-utils';

test('should enable source map from CLI', async ({ prepareDist, execCliSync }) => {
  const distPath = await prepareDist();
  execCliSync('build --source-map');

  const outputs = await readDirContents(distPath);
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.some((file) => file.endsWith('.js.map'))).toBeTruthy();
});

test('should disable source map from CLI', async ({ prepareDist, execCliSync }) => {
  const distPath = await prepareDist();
  execCliSync('build --config source-map.config.ts --no-source-map');

  const outputs = await readDirContents(distPath);
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.some((file) => file.endsWith('.js.map'))).toBeFalsy();
});

test('should reject source map type from CLI', async ({ execCliSync }) => {
  expect(() => {
    execCliSync('build --source-map hidden-source-map', {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  }).toThrowError(/The "--source-map" option only accepts a boolean value/);
});
