import { createConnectHandler } from '@e2e/helper/server';
import { getRandomPort } from '@e2e/helper';
import { createAdaptorServer } from '@hono/node-server';
import { createRsbuild } from '@rsbuild/core';
import { Hono } from 'hono';

export async function startDevServer(fixtures) {
  const customServerPort = await getRandomPort();

  const rsbuild = await createRsbuild({
    cwd: fixtures,
    config: {
      server: {
        port: customServerPort,
        htmlFallback: false,
        middlewareMode: true,
      },
    },
  });

  const app = new Hono();

  const rsbuildServer = await rsbuild.createDevServer();

  const { middlewares, close, port } = rsbuildServer;

  app.get('/aaa', (c) => c.text('Hello World!'));
  app.get('/bbb', (c) => c.text('Hello hono!'));
  app.all('*', createConnectHandler(middlewares));

  const server = createAdaptorServer({ fetch: app.fetch });

  await new Promise((resolve) => {
    server.listen({ host: 'localhost', port }, resolve);
  });
  await rsbuildServer.afterListen();

  rsbuildServer.connectWebSocket({ server });

  return {
    config: { port },
    close: async () => {
      await close();
      server.close();
    },
  };
}
