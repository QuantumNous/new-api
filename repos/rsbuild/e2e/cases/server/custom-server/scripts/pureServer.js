import { createConnectHandler } from '@e2e/helper/server';
import { getRandomPort } from '@e2e/helper';
import { createAdaptorServer } from '@hono/node-server';
import { createRsbuild } from '@rsbuild/core';
import { Hono } from 'hono';

// Start custom dev server without compile
export async function startDevServerPure(fixtures) {
  const customServerPort = await getRandomPort();

  const rsbuild = await createRsbuild({
    cwd: fixtures,
    config: {
      server: {
        port: customServerPort,
        htmlFallback: false,
        middlewareMode: true,
        setup: ({ action, server }) => {
          if (action !== 'dev') {
            return;
          }

          server.middlewares.use((req, res, next) => {
            if (req.url === '/test') {
              res.writeHead(302, {
                Location: '/bbb',
              });
              res.end();
            } else {
              next();
            }
          });
        },
      },
    },
  });

  const app = new Hono();

  const rsbuildServer = await rsbuild.createDevServer({ runCompile: false });

  app.get('/aaa', (c) => c.text('Hello World!'));
  app.get('/bbb', (c) => c.text('Hello hono!'));
  app.all('*', createConnectHandler(rsbuildServer.middlewares));

  const server = createAdaptorServer({ fetch: app.fetch });

  await new Promise((resolve) => {
    server.listen({ host: 'localhost', port: rsbuildServer.port }, resolve);
  });
  await rsbuildServer.afterListen();

  return {
    config: { port: rsbuildServer.port },
    close: async () => {
      await rsbuildServer.close();
      server.close();
    },
  };
}
