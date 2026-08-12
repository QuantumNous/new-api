import fs from 'node:fs';
import path from 'node:path';
import { enableDebugMode, expect, test } from '@e2e/helper';

const getRsbuildConfig = (dist: string) =>
  path.resolve(import.meta.dirname, `./${dist}/.rsbuild/rsbuild.config.mjs`);

const getBundlerConfig = (dist: string) =>
  path.resolve(import.meta.dirname, `./${dist}/.rsbuild/rspack.config.web.mjs`);

test('should generate config files in debug mode when build', async ({ build }) => {
  const restore = enableDebugMode();
  const distRoot = 'dist-1';
  const rsbuild = await build({
    config: {
      output: {
        distPath: distRoot,
      },
    },
  });

  expect(fs.existsSync(getRsbuildConfig(distRoot))).toBeTruthy();
  expect(fs.existsSync(getBundlerConfig(distRoot))).toBeTruthy();

  await rsbuild.expectLog('config inspection completed');
  await rsbuild.expectLog('creating compiler');
  restore();
});

test('should generate config files in debug mode when dev', async ({ page, dev }) => {
  const restore = enableDebugMode();
  const distRoot = 'dist-2';
  const rsbuild = await dev({
    config: {
      output: {
        distPath: distRoot,
      },
    },
    page,
  });

  expect(fs.existsSync(getRsbuildConfig(distRoot))).toBeTruthy();
  expect(fs.existsSync(getBundlerConfig(distRoot))).toBeTruthy();

  await rsbuild.expectLog('config inspection completed');
  await rsbuild.expectLog('creating compiler');
  restore();
});
