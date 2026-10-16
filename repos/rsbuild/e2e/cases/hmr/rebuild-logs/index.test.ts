import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('should print changed files in logs', async ({ page, dev, editFile, copySrcDir }) => {
  const tempSrc = await copySrcDir();

  const rsbuild = await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  await editFile(join(tempSrc, 'App.tsx'), (code) =>
    code.replace('Hello Rsbuild!', 'Hello Rsbuild2!'),
  );

  await rsbuild.expectLog('building test-temp-src/App.tsx', { posix: true });
});

test('should print removed files in logs', async ({ page, dev, copySrcDir }) => {
  const tempSrc = await copySrcDir();

  const rsbuild = await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  const appPath = join(tempSrc, 'App.tsx');

  await fs.promises.unlink(appPath);

  await rsbuild.expectLog('building removed test-temp-src/App.tsx', {
    posix: true,
  });
});
