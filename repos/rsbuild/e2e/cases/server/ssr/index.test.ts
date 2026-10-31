import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('support SSR', async ({ page, devOnly }) => {
  const rsbuild = await devOnly();

  const url = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url.href);
  await expect(page.locator('body')).toContainText('Rsbuild with React');

  await page.goto(url.href);

  // bundle result should cacheable and only load once.
  expect(rsbuild.logs.filter((log) => log.includes('load SSR')).length).toBe(1);
});

test('support SSR with autoExternal', async ({ page, devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      environments: {
        node: {
          output: {
            autoExternal: true,
          },
        },
      },
    },
  });

  const url = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url.href);
  await expect(page.locator('body')).toContainText('Rsbuild with React');

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'dist/index.js');
  expect(content).toContain('module.exports = require("react")');
  expect(content).toContain('module.exports = require("react-dom/server")');

  await page.goto(url.href);

  // bundle result should cacheable and only load once.
  expect(rsbuild.logs.filter((log) => log.includes('load SSR')).length).toBe(1);
});

test('support SSR with esm target', async ({ page, devOnly }) => {
  process.env.TEST_ESM_LIBRARY = 'true';

  const rsbuild = await devOnly();

  const url1 = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url1.href);
  await expect(page.locator('body')).toContainText('Rsbuild with React');

  delete process.env.TEST_ESM_LIBRARY;
});

test('support SSR with esm target and autoExternal', async ({ page, devOnly }) => {
  process.env.TEST_ESM_LIBRARY = 'true';

  const rsbuild = await devOnly({
    config: {
      environments: {
        node: {
          output: {
            autoExternal: true,
          },
        },
      },
    },
  });

  const url1 = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url1.href);
  await expect(page.locator('body')).toContainText('Rsbuild with React');

  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'dist/index.mjs');
  expect(content).toContain('import * as __rspack_external_react');
  expect(content).toContain('from "react-dom/server"');

  delete process.env.TEST_ESM_LIBRARY;
});

test('support SSR with split chunk', async ({ page, devOnly }) => {
  process.env.TEST_SPLIT_CHUNK = '1';

  const rsbuild = await devOnly();
  const url1 = new URL(`http://localhost:${rsbuild.port}`);

  await page.goto(url1.href);
  await expect(page.locator('body')).toContainText('Rsbuild with React');

  delete process.env.TEST_SPLIT_CHUNK;
});
