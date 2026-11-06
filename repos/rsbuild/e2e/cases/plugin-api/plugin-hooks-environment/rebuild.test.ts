import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import type { RsbuildPlugin } from '@rsbuild/core';
import fse from 'fs-extra';

const createPlugin = () => {
  const names: string[] = [];

  const plugin: RsbuildPlugin = {
    name: 'test-plugin',
    setup(api) {
      api.onBeforeEnvironmentCompile(({ environment }) => {
        names.push(`BeforeEnvironmentCompile ${environment.name}`);
      });
      api.onBeforeDevCompile(() => {
        names.push('BeforeDevCompile');
      });
    },
  };

  return { plugin, names };
};

test('should run onBeforeDevCompile hook correctly when rebuild in dev with multiple environments', async ({
  dev,
}) => {
  const indexJs = join(import.meta.dirname, 'test-temp-src', 'index.js');
  await fse.outputFile(indexJs, "console.log('1');");

  const { plugin, names } = createPlugin();

  const rsbuild = await dev({
    config: {
      plugins: [plugin],
      environments: {
        web: {},
        node: {
          source: {
            entry: {
              index: './test-temp-src/index.js',
            },
          },
        },
      },
    },
  });

  // initial build
  await rsbuild.expectBuildEnd();
  expect(names.includes('BeforeDevCompile')).toBeTruthy();
  expect(names.includes('BeforeEnvironmentCompile node')).toBeTruthy();
  expect(names.includes('BeforeEnvironmentCompile web')).toBeTruthy();

  // clear state
  rsbuild.clearLogs();
  names.length = 0;

  // rebuild
  await fse.outputFile(indexJs, "console.log('2');");
  await rsbuild.expectLog('building test-temp-src');
  await rsbuild.expectBuildEnd();

  expect(names).toEqual([
    'BeforeDevCompile',
    // only recompile the node environment which is affected by the file change
    'BeforeEnvironmentCompile node',
  ]);
});
