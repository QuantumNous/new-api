import { expect, HMR_CONNECTED_LOG, test } from '@e2e/helper';
import { getRandomPort } from '@rstackjs/test-utils';
import { createRsbuild } from '@rsbuild/core';

test('should send HMR messages to the matched environment only', async ({ page, context }) => {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      mode: 'development',
      server: {
        port: await getRandomPort(),
      },
      environments: {
        web: {},
        web1: {
          dev: {
            assetPrefix: 'auto',
          },
          source: {
            entry: {
              main: './src/web1.ts',
            },
          },
          output: {
            distPath: {
              root: 'dist/web1',
              html: 'html1',
            },
          },
        },
      },
    },
  });

  const server = await rsbuild.createDevServer();

  await server.listen();
  const web1Page = await context.newPage();
  const pageHmrConnected = page.waitForEvent('console', {
    predicate: (message) => message.text() === HMR_CONNECTED_LOG,
  });
  const web1PageHmrConnected = web1Page.waitForEvent('console', {
    predicate: (message) => message.text() === HMR_CONNECTED_LOG,
  });

  await Promise.all([
    page.goto(`http://localhost:${server.port}`),
    web1Page.goto(`http://localhost:${server.port}/web1/html1/main`),
    pageHmrConnected,
    web1PageHmrConnected,
  ]);

  await expect(page.locator('#title')).toHaveText('web');
  await expect(web1Page.locator('#title')).toHaveText('web1');
  await expect(page.locator('#count')).toHaveText('0');
  await expect(web1Page.locator('#count')).toHaveText('0');

  server.environments.web.hot.send('custom', {
    event: 'count',
  });

  await expect(page.locator('#count')).toHaveText('1');
  await expect(web1Page.locator('#count')).toHaveText('0');

  server.environments.web1.hot.send('custom', {
    event: 'count',
  });

  await expect(page.locator('#count')).toHaveText('1');
  await expect(web1Page.locator('#count')).toHaveText('1');

  await web1Page.close();
  await server.close();
});
