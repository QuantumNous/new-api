import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@e2e/helper';
import type { RsbuildConfig } from '@rsbuild/core';
import fse from 'fs-extra';

test('should respect `buildCache.buildDependencies`', async ({ build }) => {
  const cacheDirectory = path.resolve(
    import.meta.dirname,
    './node_modules/.cache/test-cache-build-dependencies',
  );

  const testDepsPath = path.resolve(import.meta.dirname, './test-temp-deps.js');

  await fse.remove(cacheDirectory);

  const getBuildConfig = (input: string) => {
    fs.writeFileSync(testDepsPath, input);
    return {
      config: {
        tools: {
          bundlerChain: (chain) => {
            if (input === 'foo') {
              chain.resolve.extensions.prepend('.test.js');
            }
          },
        },
        performance: {
          buildCache: {
            cacheDirectory,
            buildDependencies: [testDepsPath],
          },
        },
      } as RsbuildConfig,
    };
  };

  // first build without cache
  let rsbuild = await build(getBuildConfig(''));

  expect((await rsbuild.getIndexBundle()).includes('222222')).toBeTruthy();

  rsbuild = await build(getBuildConfig('foo'));

  // extension '.test.js' should work
  expect((await rsbuild.getIndexBundle()).includes('111111')).toBeTruthy();
});
