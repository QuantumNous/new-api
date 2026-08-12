import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import fse from 'fs-extra';

const cwd = import.meta.dirname;

test.beforeEach(() => {
  const dirs = ['dist', 'dist-1', 'dist-2', 'dist-same', 'dist-same-1'];
  for (const dir of dirs) {
    const target = join(cwd, dir);
    fse.removeSync(target);
  }
});

test('should handle writeToDisk correctly across multiple environments', async ({ page, dev }) => {
  await dev({
    config: {
      dev: {
        writeToDisk: true,
      },
      environments: {
        web: {
          dev: {
            writeToDisk: false,
          },
        },
        web1: {
          output: {
            distPath: 'dist-1',
          },
          dev: {
            writeToDisk: true,
          },
        },
        web2: {
          output: {
            distPath: 'dist-2',
          },
        },
      },
    },
  });

  const test = page.locator('#test');
  await expect(test).toHaveText('Hello Rsbuild!');

  expect(fs.existsSync(join(cwd, 'dist/index.html'))).toBeFalsy();
  expect(fs.existsSync(join(cwd, 'dist-1/index.html'))).toBeTruthy();
  expect(fs.existsSync(join(cwd, 'dist-2/index.html'))).toBeTruthy();
});

test('should writeToDisk correctly when environment writeToDisk configuration same', async ({
  page,
  dev,
}) => {
  await dev({
    config: {
      dev: {
        writeToDisk: false,
      },
      environments: {
        web: {
          output: {
            distPath: 'dist-same',
          },
          dev: {
            writeToDisk: true,
          },
        },
        web1: {
          output: {
            distPath: 'dist-same-1',
          },
          dev: {
            writeToDisk: true,
          },
        },
      },
    },
  });

  const test = page.locator('#test');
  await expect(test).toHaveText('Hello Rsbuild!');

  expect(fs.existsSync(join(cwd, 'dist-same/index.html'))).toBeTruthy();
  expect(fs.existsSync(join(cwd, 'dist-same-1/index.html'))).toBeTruthy();
});
