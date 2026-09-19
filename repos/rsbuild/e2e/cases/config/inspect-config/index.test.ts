import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';
import { createRsbuild } from '@rsbuild/core';

test.afterEach(async ({ prepareDist }) => {
  await prepareDist();
  await prepareDist('test-temp-output');
});

const rsbuildConfig = path.resolve(import.meta.dirname, './dist/.rsbuild/rsbuild.config.mjs');

const rsbuildNodeConfig = path.resolve(
  import.meta.dirname,
  './dist/.rsbuild/rsbuild.config.node.mjs',
);
const rspackConfig = path.resolve(import.meta.dirname, `./dist/.rsbuild/rspack.config.web.mjs`);
const bundlerNodeConfig = path.resolve(
  import.meta.dirname,
  `./dist/.rsbuild/rspack.config.node.mjs`,
);

const INSPECT_LOG = 'config inspection completed';

test('should generate config files when writeToDisk is true', async ({ logHelper }) => {
  const { expectLog } = logHelper;

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });
  await rsbuild.inspectConfig({
    writeToDisk: true,
  });

  expect(fs.existsSync(rspackConfig)).toBeTruthy();
  expect(fs.existsSync(rsbuildConfig)).toBeTruthy();
  await expectLog(INSPECT_LOG);
});

test('should generate config files correctly when output is specified', async ({ logHelper }) => {
  const { expectLog } = logHelper;

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });
  await rsbuild.inspectConfig({
    writeToDisk: true,
    outputPath: 'foo',
  });

  const rspackConfig = path.resolve(import.meta.dirname, `./dist/foo/rspack.config.web.mjs`);

  const rsbuildConfig = path.resolve(import.meta.dirname, './dist/foo/rsbuild.config.mjs');

  expect(fs.existsSync(rspackConfig)).toBeTruthy();
  expect(fs.existsSync(rsbuildConfig)).toBeTruthy();
  await expectLog(INSPECT_LOG);
});

test('should generate bundler config for node when target contains node', async ({ logHelper }) => {
  const { expectLog } = logHelper;

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      environments: {
        web: {},
        node: {
          output: {
            target: 'node',
          },
        },
      },
    },
  });
  await rsbuild.inspectConfig({
    writeToDisk: true,
  });

  expect(fs.existsSync(rsbuildNodeConfig)).toBeTruthy();
  expect(fs.existsSync(rspackConfig)).toBeTruthy();
  expect(fs.existsSync(bundlerNodeConfig)).toBeTruthy();
  await expectLog(INSPECT_LOG);
});

test('should not generate config files when writeToDisk is false', async () => {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });
  await rsbuild.inspectConfig({
    writeToDisk: false,
  });

  expect(fs.existsSync(rsbuildConfig)).toBeFalsy();
  expect(fs.existsSync(rspackConfig)).toBeFalsy();
});

test('should allow to specify absolute output path', async ({ logHelper }) => {
  const { expectLog } = logHelper;

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });
  const outputPath = path.join(import.meta.dirname, 'test-temp-output');

  await rsbuild.inspectConfig({
    writeToDisk: true,
    outputPath,
  });

  await expectLog(INSPECT_LOG);

  expect(fs.existsSync(path.join(outputPath, 'rspack.config.web.mjs'))).toBeTruthy();
});

test('should generate extra config files', async ({ logHelper }) => {
  const { expectLog } = logHelper;

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });
  await rsbuild.inspectConfig({
    writeToDisk: true,
    extraConfigs: {
      rstest: {
        include: ['**/*.test.ts'],
      },
    },
  });

  const rstestConfig = path.resolve(import.meta.dirname, './dist/.rsbuild/rstest.config.mjs');

  expect(fs.existsSync(rstestConfig)).toBeTruthy();
  await expectLog('Rstest Config:');
});

test('should apply plugin correctly', async () => {
  let servePluginApplied = false;
  let buildPluginApplied = false;

  const servePlugin: RsbuildPlugin = {
    name: 'serve-plugin',
    apply: 'serve',
    setup: () => {
      servePluginApplied = true;
    },
  };

  const buildPlugin: RsbuildPlugin = {
    name: 'build-plugin',
    apply: 'build',
    setup: () => {
      buildPluginApplied = true;
    },
  };

  const rsbuild1 = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      mode: 'development',
      plugins: [servePlugin, buildPlugin],
    },
  });
  await rsbuild1.inspectConfig();

  expect(servePluginApplied).toBe(true);
  expect(buildPluginApplied).toBe(false);

  servePluginApplied = false;

  const rsbuild2 = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      mode: 'production',
      plugins: [servePlugin, buildPlugin],
    },
  });
  await rsbuild2.inspectConfig();

  expect(servePluginApplied).toBe(false);
  expect(buildPluginApplied).toBe(true);
});
