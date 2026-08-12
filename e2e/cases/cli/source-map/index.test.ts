import fs from 'node:fs';
import path from 'node:path';
import { expect, readDirContents, test } from '@e2e/helper';

const distPath = path.join(import.meta.dirname, 'dist');

test.beforeEach(() => {
  fs.rmSync(distPath, { recursive: true, force: true });
});

test('should enable source map from CLI', async ({ execCliSync }) => {
  execCliSync('build --source-map');

  const outputs = await readDirContents(distPath);
  const outputFiles = Object.keys(outputs);

  expect(outputFiles.some((file) => file.endsWith('.js.map'))).toBeTruthy();
});

test('should disable source map from CLI', async ({ execCliSync }) => {
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
