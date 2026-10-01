import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';
import fse from 'fs-extra';

const localFile = path.join(import.meta.dirname, '.env.local');
const prodLocalFile = path.join(import.meta.dirname, '.env.production.local');

test.beforeEach(async () => {
  await fse.remove(localFile);
  await fse.remove(prodLocalFile);
});

test('should load .env config and allow rsbuild.config.ts to read env vars', async ({
  execCliSync,
}) => {
  execCliSync('build');
  expect(fs.existsSync(path.join(import.meta.dirname, 'dist/1'))).toBeTruthy();
});

test('should load .env.local with higher priority', async ({ execCliSync }) => {
  fse.outputFileSync(localFile, 'FOO=2');

  execCliSync('build');
  expect(fs.existsSync(path.join(import.meta.dirname, 'dist/2'))).toBeTruthy();
});

test('should load .env.production.local with higher priority', async ({ execCliSync }) => {
  fse.outputFileSync(localFile, 'FOO=2');
  fse.outputFileSync(prodLocalFile, 'FOO=3');

  execCliSync('build');
  expect(fs.existsSync(path.join(import.meta.dirname, 'dist/3'))).toBeTruthy();
});

test('should support specifying env mode via --env-mode', async ({ execCliSync }) => {
  execCliSync('build --env-mode test');
  expect(fs.existsSync(path.join(import.meta.dirname, 'dist/5'))).toBeTruthy();
});
