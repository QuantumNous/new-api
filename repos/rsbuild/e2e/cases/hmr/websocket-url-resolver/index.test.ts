import { join } from 'node:path';
import { expect, test } from '@e2e/helper';

test('HMR should work with webSocketUrlResolver', async ({ page, dev, editFile, copySrcDir }) => {
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
          host: 'example.com',
          webSocketUrlResolver: join(import.meta.dirname, 'resolveWebSocketUrl.ts'),
        },
      },
    },
  });

  const resolvedURL = await page.evaluate(() => window.__RSBUILD_WEBSOCKET_URL__);

  expect(resolvedURL).toContain(`://${new URL(page.url()).host}/rsbuild-hmr?`);

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild!');

  await editFile(join(tempSrc, 'App.tsx'), (code) => code.replace('Hello Rsbuild', 'Hello Test'));

  await expect(locator).toHaveText('Hello Test!');
});
