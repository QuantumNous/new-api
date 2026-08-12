import fs from 'node:fs';
import path from 'node:path';
import { expect, expectFile, test } from '@e2e/helper';
import fse from 'fs-extra';

const cacheDirectory = path.resolve(import.meta.dirname, './node_modules/.cache');

test.beforeAll(async () => {
  await fse.remove(cacheDirectory);
});

test('should use `buildCache.cacheDirectory` as expected in dev', async ({ dev }) => {
  const customDirectory = path.resolve(import.meta.dirname, './node_modules/.cache2/dev');
  await fse.remove(customDirectory);

  await dev({
    config: {
      performance: {
        buildCache: {
          cacheDirectory: customDirectory,
        },
      },
    },
  });

  await expectFile(customDirectory);
  expect(fs.existsSync(cacheDirectory)).toBeFalsy();
});

test('should use `buildCache.cacheDirectory` as expected in build', async ({ build }) => {
  const customDirectory = path.resolve(import.meta.dirname, './node_modules/.cache2/build');
  await fse.remove(customDirectory);

  await build({
    config: {
      performance: {
        buildCache: {
          cacheDirectory: customDirectory,
        },
      },
    },
  });

  await expectFile(customDirectory);
  expect(fs.existsSync(cacheDirectory)).toBeFalsy();
});
