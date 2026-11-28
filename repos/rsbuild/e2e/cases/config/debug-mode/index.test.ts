import fs from 'node:fs';
import path from 'node:path';
import { enableDebugMode, expect, test } from '@e2e/helper';

const getRsbuildConfig = (distPath: string) => path.join(distPath, '.rsbuild/rsbuild.config.mjs');

const getBundlerConfig = (distPath: string) =>
  path.join(distPath, '.rsbuild/rspack.config.web.mjs');

test('should generate config files in debug mode when build', async ({ build, prepareDist }) => {
  const restore = enableDebugMode();
  const distRoot = 'dist-1';
  const distPath = await prepareDist(distRoot);
  const rsbuild = await build({
    config: {
      output: {
        distPath: distRoot,
      },
    },
  });

  expect(fs.existsSync(getRsbuildConfig(distPath))).toBeTruthy();
  expect(fs.existsSync(getBundlerConfig(distPath))).toBeTruthy();

  await rsbuild.expectLog('config inspection completed');
  await rsbuild.expectLog('creating compiler');
  restore();
});

test('should generate config files in debug mode when dev', async ({ prepareDist, page, dev }) => {
  const restore = enableDebugMode();
  const distRoot = 'dist-2';
  const distPath = await prepareDist(distRoot);
  const rsbuild = await dev({
    config: {
      output: {
        distPath: distRoot,
      },
    },
    page,
  });

  expect(fs.existsSync(getRsbuildConfig(distPath))).toBeTruthy();
  expect(fs.existsSync(getBundlerConfig(distPath))).toBeTruthy();

  await rsbuild.expectLog('config inspection completed');
  await rsbuild.expectLog('creating compiler');
  restore();
});
