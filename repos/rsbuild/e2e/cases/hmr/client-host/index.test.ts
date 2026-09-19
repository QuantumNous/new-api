import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('HMR should work when setting dev.port and dev.client.host', async ({
  page,
  dev,
  editFile,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.ts'),
        },
      },
      dev: {
        client: {
          host: '',
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('Hello Rsbuild', 'Hello Test'));

  await expect(locator).toHaveText('Hello Test!');
});
