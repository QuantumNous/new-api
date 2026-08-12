import { expect, getRandomPort, test } from '@e2e/helper';
import { createConnectHandler } from '@e2e/helper/server';
import { createAdaptorServer } from '@hono/node-server';
import { createRsbuild } from '@rsbuild/core';
import { Hono } from 'hono';

test('multiple rsbuild dev servers should work correctly', async ({ page }) => {
  const rsbuild1 = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      mode: 'development',
      source: {
        entry: {
          index: './src/index1',
        },
      },
      output: {
        distPath: 'dist-1',
      },
      dev: {
        assetPrefix: '/app1',
      },
      server: {
        middlewareMode: true,
      },
    },
  });

  const rsbuild2 = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      mode: 'development',
      source: {
        entry: {
          index: './src/index2',
        },
      },
      output: {
        distPath: 'dist-2',
      },
      server: {
        middlewareMode: true,
      },
      dev: {
        assetPrefix: '/app2',
      },
      environments: {
        web1: {},
      },
    },
  });

  const rsbuildServer1 = await rsbuild1.createDevServer();
  const rsbuildServer2 = await rsbuild2.createDevServer();

  const app = new Hono();
  const app1Handler = createConnectHandler(rsbuildServer1.middlewares);
  const app2Handler = createConnectHandler(rsbuildServer2.middlewares);

  app.all('/app1', app1Handler);
  app.all('/app1/*', app1Handler);
  app.all('/app2', app2Handler);
  app.all('/app2/*', app2Handler);

  const port = await getRandomPort();
  const server = createAdaptorServer({ fetch: app.fetch });

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  page.goto(`http://localhost:${port}/app1`);
  await expect(page.innerHTML('#test')).resolves.toBe('Hello Rsbuild1!');

  page.goto(`http://localhost:${port}/app2`);
  await expect(page.innerHTML('#test')).resolves.toBe('Hello Rsbuild2!');

  await rsbuildServer1.close();
  await rsbuildServer2.close();

  server.close();
});
