import path from 'node:path';

import { expect, test } from '@e2e/helper';
import type { RsbuildConfig } from '@rsbuild/core';
import fse from 'fs-extra';

test('should respect `buildCache.cacheDigest`', async ({ build }) => {
  const cacheDirectory = path.resolve(
    import.meta.dirname,
    './node_modules/.cache/test-cache-digest',
  );

  await fse.remove(cacheDirectory);

  const getBuildConfig = (input: string) => ({
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
          cacheDigest: [input],
        },
      },
    } as RsbuildConfig,
  });

  // first build without cache
  let rsbuild = await build(getBuildConfig(''));

  expect((await rsbuild.getIndexBundle()).includes('222222')).toBeTruthy();

  rsbuild = await build(getBuildConfig('foo'));

  // extension '.test.js' should work
  expect((await rsbuild.getIndexBundle()).includes('111111')).toBeTruthy();
});
