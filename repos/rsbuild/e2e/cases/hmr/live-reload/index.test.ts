import path from 'node:path';
import { expect, test } from '@e2e/helper';

test('should fallback to live-reload when dev.hmr is false', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const appFile = path.join(tempSrc, 'App.jsx');
  await dev({
    config: {
      source: {
        entry: {
          index: path.join(tempSrc, 'index.js'),
        },
      },
    },
  });

  const testEl = page.locator('#test');
  await expect(testEl).toHaveText('Hello Rsbuild!');
  await editFile(appFile, (code) => code.replace('Rsbuild', 'Live Reload'));
  await expect(testEl).toHaveText('Hello Live Reload!');
});

test('should not reload page when live-reload is disabled', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const appFile = path.join(tempSrc, 'App.jsx');
  await dev({
    config: {
      source: {
        entry: {
          index: path.join(tempSrc, 'index.js'),
        },
      },
      dev: {
        liveReload: false,
      },
    },
  });

  const test = page.locator('#test');
  await expect(test).toHaveText('Hello Rsbuild!');
  await editFile(appFile, (code) => code.replace('Rsbuild', 'Live Reload'));
  await expect(test).toHaveText('Hello Rsbuild!');
});
